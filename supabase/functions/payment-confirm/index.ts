import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // 1. Detect request content/type
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    }

    console.log(`[PAYMENT WEBHOOK] Received request. Path: ${url.pathname}, Content-type: ${contentType}, Body:`, JSON.stringify(body));

    // 2. Identify Provider
    // CLICK sends fields like click_trans_id, merchant_trans_id, action, error
    const isClick = body.click_trans_id !== undefined || body.action !== undefined;
    
    // PAYME JSON-RPC 2.0 sends method and params
    const isPayme = body.method !== undefined && body.jsonrpc === "2.0";

    if (isClick) {
      return await handleClick(body);
    } else if (isPayme) {
      return await handlePayme(body);
    } else {
      // Fallback for custom dashboard triggers or manual activation
      const { payment_ref, provider } = body;
      if (payment_ref) {
        const success = await activateSubscription(payment_ref, provider || "manual");
        if (success) {
          return new Response(JSON.stringify({ success: true, message: "Subscription activated" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Subscription not found or activation failed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ error: "Invalid payment format. Only Click & Payme webhooks are supported." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[PAYMENT ERROR] Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Handle Click Webhook Actions
 * Action 0: Prepare
 * Action 1: Complete
 */
async function handleClick(body: any) {
  const clickTransId = body.click_trans_id;
  const merchantTransId = body.merchant_trans_id; // our orderId / payment_ref
  const amount = parseFloat(body.amount);
  const action = parseInt(body.action);
  const error = parseInt(body.error);

  console.log(`[CLICK WEBHOOK] action: ${action}, clickTransId: ${clickTransId}, orderId: ${merchantTransId}, amount: ${amount}`);

  if (error < 0) {
    return new Response(JSON.stringify({ error: -9, error_note: "Transaction error" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Find subscription by payment_ref
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("payment_ref", merchantTransId)
    .maybeSingle();

  if (fetchError || !sub) {
    console.warn("[CLICK Prepare/Complete] Subscription not found for:", merchantTransId);
    return new Response(JSON.stringify({ error: -5, error_note: "User/Order does not exist" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify amount matches
  if (Math.abs(sub.amount_uzs - amount) > 1) {
    return new Response(JSON.stringify({ error: -2, error_note: "Incorrect parameter amount" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // If already paid/active
  if (sub.status === "active") {
    return new Response(JSON.stringify({
      error: 0,
      error_note: "Success",
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: sub.id,
      merchant_confirm_id: sub.id,
    }), { headers: { "Content-Type": "application/json" } });
  }

  if (action === 0) {
    // Action 0 is Prepare
    return new Response(JSON.stringify({
      error: 0,
      error_note: "Success",
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: sub.id,
    }), { headers: { "Content-Type": "application/json" } });
  } else if (action === 1) {
    // Action 1 is Complete
    const success = await activateSubscription(merchantTransId, "click");
    if (success) {
      return new Response(JSON.stringify({
        error: 0,
        error_note: "Success",
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: sub.id,
      }), { headers: { "Content-Type": "application/json" } });
    } else {
      return new Response(JSON.stringify({ error: -1, error_note: "Sign check failed / update failed" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: -3, error_note: "Action not found" }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Handle Payme JSON-RPC 2.0 Webhook Methods
 */
async function handlePayme(body: any) {
  const { id, method, params } = body;
  console.log(`[PAYME WEBHOOK] method: ${method}, id: ${id}`);

  // Base Response Structure
  const respond = (resultData: any) => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: id,
    result: resultData,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const error = (code: number, message: string) => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: id,
    error: { code, message },
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (method === "CheckPerformTransaction") {
    const orderId = params.account?.order_id;
    const amountTiyin = params.amount;
    const amountUzs = amountTiyin / 100;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", orderId)
      .maybeSingle();

    if (!sub) {
      return error(-31050, "Order not found");
    }

    if (Math.abs(sub.amount_uzs - amountUzs) > 1) {
      return error(-31001, "Incorrect amount");
    }

    return respond({ allow: true });
  }

  if (method === "CreateTransaction") {
    const orderId = params.account?.order_id;
    const paymeTransId = params.id;
    const time = params.time;

    // Check if we already mapped this transaction ID
    let { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", paymeTransId)
      .maybeSingle();

    if (!sub) {
      // Find the subscription by original orderId
      const { data: subByOrder } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("payment_ref", orderId)
        .maybeSingle();

      if (!subByOrder) {
        return error(-31050, "Order not found");
      }

      sub = subByOrder;

      // Map the transaction: Save Payme transaction ID in payment_ref
      const { error: updateErr } = await supabase
        .from("subscriptions")
        .update({ payment_ref: paymeTransId })
        .eq("id", sub.id);

      if (updateErr) {
        return error(-31008, "Failed to map Payme transaction ID");
      }
    }

    return respond({
      create_time: time,
      transaction: paymeTransId,
      state: 1,
    });
  }

  if (method === "PerformTransaction") {
    const paymeTransId = params.id;

    // Find subscription by the Payme transaction ID
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", paymeTransId)
      .maybeSingle();

    if (!sub) {
      return error(-31050, "Transaction not found");
    }

    if (sub.status === "active") {
      return respond({
        transaction: paymeTransId,
        perform_time: new Date(sub.started_at || Date.now()).getTime(),
        state: 2,
      });
    }

    if (sub.status === "cancelled") {
      return error(-31008, "Transaction already cancelled");
    }

    const success = await activateSubscription(paymeTransId, "payme");
    if (success) {
      return respond({
        transaction: paymeTransId,
        perform_time: Date.now(),
        state: 2,
      });
    }

    return error(-31008, "Failed to perform transaction");
  }

  if (method === "CheckTransaction") {
    const paymeTransId = params.id;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", paymeTransId)
      .maybeSingle();

    if (!sub) {
      return error(-31050, "Transaction not found");
    }

    let state = 1;
    let performTime = 0;
    let cancelTime = 0;

    if (sub.status === "active") {
      state = 2;
      performTime = new Date(sub.started_at || Date.now()).getTime();
    } else if (sub.status === "cancelled") {
      state = -1;
      cancelTime = new Date(sub.expires_at || Date.now()).getTime();
    }

    return respond({
      create_time: new Date(sub.created_at || Date.now()).getTime(),
      perform_time: performTime,
      cancel_time: cancelTime,
      state: state,
      reason: null,
    });
  }

  if (method === "CancelTransaction") {
    const paymeTransId = params.id;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", paymeTransId)
      .maybeSingle();

    if (!sub) {
      return error(-31050, "Transaction not found");
    }

    if (sub.status === "active") {
      return error(-31007, "Cannot cancel performed transaction");
    }

    if (sub.status === "cancelled") {
      return respond({
        cancel_time: new Date(sub.expires_at || Date.now()).getTime(),
        state: -1,
      });
    }

    const { error: updateErr } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    if (updateErr) {
      return error(-31008, "Failed to cancel transaction");
    }

    return respond({
      cancel_time: Date.now(),
      state: -1,
    });
  }

  return error(-32601, "Method not found");
}

/**
 * Update Barber Subscription
 */
async function activateSubscription(paymentRef: string, provider: string): Promise<boolean> {
  try {
    // 1. Fetch the subscription
    const { data: sub, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_ref", paymentRef)
      .maybeSingle();

    if (fetchError || !sub) {
      console.error("[ACTIVATE ERROR] Subscription not found for ref:", paymentRef);
      return false;
    }

    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // 2. Update Subscription status to active
    const { error: subUpdateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        provider: provider,
      })
      .eq("id", sub.id);

    if (subUpdateError) {
      console.error("[ACTIVATE ERROR] Sub status update failed:", subUpdateError);
      return false;
    }

    // 3. Update Barber subscription status & expiry timestamp
    const { error: barberUpdateError } = await supabase
      .from("barbers")
      .update({
        is_subscribed: true,
        sub_expires_at: expiresAt.toISOString(),
      })
      .eq("id", sub.barber_id);

    if (barberUpdateError) {
      console.error("[ACTIVATE ERROR] Barber status update failed:", barberUpdateError);
      return false;
    }

    console.log(`[ACTIVATE SUCCESS] Activated subscription ${sub.id} for barber ${sub.barber_id} via ${provider}. Expires at: ${expiresAt.toISOString()}`);
    return true;
  } catch (ex) {
    console.error("[ACTIVATE EXCEPTION]", ex);
    return false;
  }
}
