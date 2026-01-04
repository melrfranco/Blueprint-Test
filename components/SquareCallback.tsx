
import React, { useEffect, useState } from 'react';
import { SquareIntegrationService } from '../services/squareIntegration';
import { useSettings } from '../contexts/SettingsContext';
import { RefreshIcon } from './icons';

const SquareCallback: React.FC = () => {
    const [status, setStatus] = useState('Processing authorization...');
    const [error, setError] = useState<string | null>(null);
    const { integration, updateIntegration, saveAll } = useSettings();

    useEffect(() => {
        const processCode = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');

            if (!code) {
                setError('Authorization code not found. Please try connecting again.');
                setStatus('Failed');
                return;
            }

            try {
                setStatus('Exchanging code for access token...');
                const { accessToken, refreshToken, merchantId } = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment);

                setStatus('Saving connection...');
                updateIntegration({
                    ...integration,
                    squareAccessToken: accessToken,
                    squareRefreshToken: refreshToken,
                    squareMerchantId: merchantId,
                });
                // Note: saveAll() is a synchronous localStorage write
                saveAll();

                setStatus('Redirecting...');
                sessionStorage.setItem('square_just_connected', 'true');
                window.location.href = '/';

            } catch (err: any) {
                console.error("Square OAuth failed:", err);
                setError(err.message || 'An unknown error occurred during connection.');
                setStatus('Failed');
            }
        };

        processCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
            {error ? (
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Connection Failed</h1>
                    <p className="text-gray-700 mb-6">{error}</p>
                    <a href="/" className="px-6 py-3 bg-gray-800 text-white font-bold rounded-lg">Return to Dashboard</a>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <RefreshIcon className="w-16 h-16 text-brand-accent animate-spin mb-6" />
                    <h1 className="text-2xl font-bold text-gray-800">Connecting to Square...</h1>
                    <p className="text-gray-600 mt-2">{status}</p>
                </div>
            )}
        </div>
    );
};

export default SquareCallback;
