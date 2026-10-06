/**
 * Grocery Choice Owner App - Owner Login Screen
 * Supports dual login: Password authentication or 6-digit OTP verification.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';
import { validateOwnerIdentifier } from '@/utils/formatters';
import { APP_CONFIG } from '@/constants/config';
import { authApi } from '@/api/authApi';

export default function LoginScreen() {
  const { loginWithPassword, sendOtp, verifyOtpAndLogin } = useOwnerAuth();

  // Mode: 'password' | 'otp'
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');

  // Input fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP flow states
  const [otpStep, setOtpStep] = useState<'input' | 'verify'>('input');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Handle Password Login
  const handlePasswordLogin = async () => {
    setError(null);
    setInfoMessage(null);

    const validation = validateOwnerIdentifier(identifier);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    if (!password || password.trim().length === 0) {
      setError('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    const result = await loginWithPassword(identifier.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Invalid credentials or server unavailable.');
    }
  };

  // Handle Send OTP
  const handleSendOtp = async () => {
    setError(null);
    setInfoMessage(null);

    const validation = validateOwnerIdentifier(identifier);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendOtp(identifier.trim());
      setIsSubmitting(false);

      if (res && res.success) {
        setOtpStep('verify');
        setResendCooldown(APP_CONFIG.OTP_RESEND_COOLDOWN_SECONDS);
        setInfoMessage(res.message || `6-digit OTP sent to ${identifier.trim()}`);

        // Mirroring customer-app & owner website: Check development OTP endpoint
        try {
          const devRes = await authApi.getDevOtp(identifier.trim());
          if (devRes && devRes.otp) {
            setDevOtpHint(devRes.otp);
          }
        } catch {
          // Dev endpoint omitted in production - safe to ignore
        }
      } else {
        setError(res?.message || 'Failed to send OTP to store account.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Unable to dispatch OTP. Please check your credentials.');
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    setError(null);
    setInfoMessage(null);

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== APP_CONFIG.OTP_LENGTH || !/^\d{6}$/.test(cleanCode)) {
      setError('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyOtpAndLogin(identifier.trim(), cleanCode);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Invalid or expired OTP.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>🏪</Text>
            </View>
            <Text style={styles.brandTitle}>Grocery Choice</Text>
            <Text style={styles.brandSubtitle}>Store Management Portal</Text>
            <Text style={styles.brandAccessNote}>
              Restricted to Store Owners, Managers &amp; Staff
            </Text>
          </View>

          {/* Login Card */}
          <Card style={styles.loginCard}>
            {/* Method Tabs */}
            <View style={styles.methodToggleRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setLoginMethod('password');
                  setDevOtpHint(null);
                  setError(null);
                  setInfoMessage(null);
                }}
                style={[
                  styles.methodTab,
                  loginMethod === 'password' && styles.methodTabActive
                ]}
              >
                <Text
                  style={[
                    styles.methodTabText,
                    loginMethod === 'password' && styles.methodTabTextActive
                  ]}
                >
                  Password Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setLoginMethod('otp');
                  setOtpStep('input');
                  setDevOtpHint(null);
                  setError(null);
                  setInfoMessage(null);
                }}
                style={[
                  styles.methodTab,
                  loginMethod === 'otp' && styles.methodTabActive
                ]}
              >
                <Text
                  style={[
                    styles.methodTabText,
                    loginMethod === 'otp' && styles.methodTabTextActive
                  ]}
                >
                  6-Digit OTP Login
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Info Banner */}
            {infoMessage && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>{infoMessage}</Text>
              </View>
            )}

            {/* PASSWORD FLOW */}
            {loginMethod === 'password' && (
              <View style={styles.formContainer}>
                <Input
                  label="Registered Email or Mobile Number"
                  placeholder="e.g. owner@grocerychoice.com or 9876543210"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Input
                  label="Account Password"
                  placeholder="Enter your store password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  rightIcon={<Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>}
                  onRightIconPress={() => setShowPassword((prev) => !prev)}
                />

                <Button
                  title="Sign In to Store Portal"
                  onPress={handlePasswordLogin}
                  loading={isSubmitting}
                  style={styles.actionButton}
                />
              </View>
            )}

            {/* OTP FLOW */}
            {loginMethod === 'otp' && (
              <View style={styles.formContainer}>
                {otpStep === 'input' ? (
                  <>
                    <Input
                      label="Store Manager Mobile or Email"
                      placeholder="Enter 10-digit mobile or email"
                      value={identifier}
                      onChangeText={(text) => {
                        setIdentifier(text);
                        if (error) setError(null);
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />

                    <Button
                      title="Send 6-Digit OTP"
                      onPress={handleSendOtp}
                      loading={isSubmitting}
                      style={styles.actionButton}
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.otpNoticeBox}>
                      <Text style={styles.otpNoticeLabel}>OTP sent to:</Text>
                      <Text style={styles.otpNoticeTarget}>{identifier}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setOtpStep('input');
                          setOtpCode('');
                          setDevOtpHint(null);
                          setError(null);
                        }}
                        style={styles.changeTargetBtn}
                      >
                        <Text style={styles.changeTargetText}>Change</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dev OTP Helper Banner (matching Customer App pattern) */}
                    {devOtpHint ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setOtpCode(devOtpHint);
                          if (error) setError(null);
                        }}
                        style={styles.devOtpBanner}
                      >
                        <Text style={styles.devOtpText}>
                          💡 Dev Mode: Tap to auto-fill code{' '}
                          <Text style={styles.devOtpCode}>{devOtpHint}</Text>
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    <Input
                      label="Enter 6-Digit Verification Code"
                      placeholder="••••••"
                      value={otpCode}
                      onChangeText={(text) => {
                        setOtpCode(text.replace(/\D/g, '').slice(0, 6));
                        if (error) setError(null);
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.otpInput}
                    />

                    <Button
                      title="Verify Code & Sign In"
                      onPress={handleVerifyOtp}
                      loading={isSubmitting}
                      style={styles.actionButton}
                    />

                    <View style={styles.resendRow}>
                      {resendCooldown > 0 ? (
                        <Text style={styles.resendTimerText}>
                          Resend available in {resendCooldown}s
                        </Text>
                      ) : (
                        <TouchableOpacity
                          disabled={isSubmitting}
                          onPress={handleSendOtp}
                        >
                          <Text style={styles.resendLinkText}>Resend OTP Code</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </View>
            )}
          </Card>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Grocery Choice Operating System &bull; Version {APP_CONFIG.APP_VERSION}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg,
    justifyContent: 'center',
    minHeight: '100%'
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  logoIcon: {
    fontSize: 32
  },
  brandTitle: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '900'
  },
  brandSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2
  },
  brandAccessNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: '500'
  },
  loginCard: {
    padding: spacing.lg,
    borderRadius: 16
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
    marginBottom: spacing.lg
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  methodTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted
  },
  methodTabTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  formContainer: {
    marginTop: spacing.xs
  },
  actionButton: {
    marginTop: spacing.sm
  },
  eyeIcon: {
    fontSize: 16
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  errorBannerText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600'
  },
  infoBanner: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  infoBannerText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600'
  },
  otpNoticeBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  otpNoticeLabel: {
    fontSize: 12,
    color: colors.textMuted
  },
  otpNoticeTarget: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 6
  },
  changeTargetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  changeTargetText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  devOtpBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  devOtpText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center'
  },
  devOtpCode: {
    fontWeight: '700',
    color: '#78350F'
  },
  otpInput: {
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '800'
  },
  resendRow: {
    alignItems: 'center',
    marginTop: spacing.md
  },
  resendTimerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600'
  },
  resendLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700'
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted
  }
});
