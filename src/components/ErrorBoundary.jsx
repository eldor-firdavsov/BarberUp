import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        // Here you would typically send the error to Sentry or another tracking service
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 page-animate">
                    <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] text-center border border-black/5">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="text-red-500" size={36} />
                        </div>
                        <h1 className="text-2xl font-bold text-[#111] mb-3 tracking-tight">Kutilmagan xatolik!</h1>
                        <p className="text-[#666] text-sm mb-8 leading-relaxed font-medium">
                            Ilovada qandaydir xatolik yuz berdi. Iltimos, sahifani yangilang va qayta urinib ko'ring.
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                        >
                            <RefreshCw size={18} />
                            Sahifani yangilash
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
