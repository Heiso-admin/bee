"use client";

import { useState } from "react";
import { Button } from "@heiso-io/bee/components/ui/button";
import { Input } from "@heiso-io/bee/components/ui/input";
import { Label } from "@heiso-io/bee/components/ui/label";
import { useRouter } from "next/navigation";
import { generateOTP } from "../_server/otp.service";
import Header from "../_components/header";
import OTPLoginForm from "../_components/otpLoginForm";

export default function DevLoginPage() {
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Phase 1: Submit email and request OTP
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await generateOTP(email, { mode: "dev" });
        setLoading(false);

        if (!result.success) {
            setError(result.message || 'Failed to send OTP');
            return;
        }

        // Move to OTP step
        setStep('otp');
    };

    const handleLoginSuccess = () => {
        router.push("/portal");
    };

    const backToLogin = () => {
        setStep('email');
        setError('');
    };
    return (
        <div className="w-full space-y-6">

            <div className="mt-8">
                {step === 'email' && (
            <><Header
                        title="Dev Login Channel"
                        description="Admin Access Only (OTP Required)" /><form onSubmit={handleEmailSubmit} className="space-y-5">

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        setError('');
                                    } }
                                    placeholder="email"
                                    className="h-12 bg-background/50 border-white/20 focus:border-primary/50 transition-all rounded-xl"
                                    autoFocus />
                            </div>

                            {error && <p className="text-destructive text-sm font-medium ml-1">{error}</p>}

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_6px_20px_rgba(var(--primary-rgb),0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
                                    disabled={loading || !email}
                                >
                                    {loading ? "Sending OTP..." : "Send OTP"}
                                </Button>
                            </div>
                        </form></>
                )}

                {step === 'otp' && (
                    <OTPLoginForm
                        email={email}
                        setStep={backToLogin as any}
                        loginMethod={null}
                        error={error}
                        setError={setError}
                        handleLoginSuccess={handleLoginSuccess}
                        extraSignInParams={{ isDevLogin: "true" }}
                        mode="dev"
                    />
                )}
            </div>
        </div>
    );
}
