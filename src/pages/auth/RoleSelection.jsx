import { useNavigate } from 'react-router-dom';
import { t } from '../../utils/i18n.js';
import { Card } from '../../components/ui/index.js';

function RoleSelection() {
    const navigate = useNavigate();

    const handleSelectRole = (role) => {
        if (role === 'client') {
            navigate('/start');
            return;
        }
        localStorage.setItem('onboarding_data', JSON.stringify({ role }));
        navigate('/register');
    };

    return (
        <section className="page-animate min-h-screen bg-[var(--bg-base)] flex flex-col justify-center px-6 py-12 max-w-md mx-auto">
            <div className="text-center mb-10">
                <div className="w-14 h-14 bg-[var(--brand-primary)] rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5">
                    <img src="./Scissor.png" alt={t('brand.name')} className="w-7 h-7 object-contain invert" onError={e => e.target.style.display = 'none'} />
                </div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{t('brand.name')}</h1>
                <p className="text-sm text-[var(--text-secondary)]">{t('auth.roleSelection.subtitle')}</p>
            </div>

            <div className="space-y-3">
                <Card interactive className="p-5" onClick={() => handleSelectRole('barber')}>
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-[var(--bg-input)] rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
                            <img src="./Scissor.png" alt="" className="w-5 h-5" onError={e => e.target.style.display = 'none'} />
                        </div>
                        <div>
                            <h2 className="font-bold text-[var(--text-primary)]">{t('auth.roleSelection.barberTitle')}</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('auth.roleSelection.barberDesc')}</p>
                        </div>
                    </div>
                </Card>

                <Card interactive className="p-5" onClick={() => handleSelectRole('client')}>
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-[var(--bg-input)] rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
                            <img src="./Icon.png" alt="" className="w-5 h-5" onError={e => e.target.style.display = 'none'} />
                        </div>
                        <div>
                            <h2 className="font-bold text-[var(--text-primary)]">{t('auth.roleSelection.clientTitle')}</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('auth.roleSelection.clientDesc')}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <p className="text-center text-xs text-[var(--text-tertiary)] mt-8">
                {t('auth.clientEntry.barberPrompt')}{' '}
                <button type="button" onClick={() => navigate('/login')} className="text-[var(--brand-primary)] font-semibold">
                    {t('auth.clientEntry.barberLink')}
                </button>
            </p>
        </section>
    );
}

export default RoleSelection;
