import { Feather, Ionicons } from "@expo/vector-icons";
import { firebaseAuth } from "@/lib/firebase";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// Firebase JS SDK — used only on web
import { RecaptchaVerifier, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const _PROXY_HOST =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : null);

const API_BASE = _PROXY_HOST ?? "";

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+1",   flag: "🇺🇸", name: "USA / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
];

type Step = "phone" | "otp" | "success";

export interface FirebaseUser {
  uid: string;
  phoneNumber: string;
  idToken: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (user: FirebaseUser) => void;
}

// Singleton reCAPTCHA verifier for web — uses a programmatic DOM element
// so it never depends on React render timing or nativeID availability.
let _recaptchaVerifier: RecaptchaVerifier | null = null;
let _recaptchaEl: HTMLDivElement | null = null;

function getRecaptchaVerifier(): RecaptchaVerifier {
  if (!_recaptchaVerifier) {
    if (typeof document !== "undefined") {
      if (!_recaptchaEl) {
        _recaptchaEl = document.createElement("div");
        _recaptchaEl.id = "smovie-recaptcha";
        document.body.appendChild(_recaptchaEl);
      }
      _recaptchaVerifier = new RecaptchaVerifier(
        firebaseAuth,
        _recaptchaEl,
        { size: "invisible", callback: () => {} },
      );
    }
  }
  return _recaptchaVerifier!;
}

function resetRecaptchaVerifier() {
  try { _recaptchaVerifier?.clear(); } catch {}
  _recaptchaVerifier = null;
  // Remove the DOM element from body so the reCAPTCHA badge disappears
  if (_recaptchaEl && _recaptchaEl.parentNode) {
    _recaptchaEl.parentNode.removeChild(_recaptchaEl);
  }
  _recaptchaEl = null;
}

async function signInWithGoogle(onSuccess: (user: FirebaseUser) => void, setError: (e: string) => void, setLoading: (v: boolean) => void) {
  if (Platform.OS !== "web") { setError("Google sign-in is only available on web."); return; }
  setLoading(true);
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    const user = result.user;
    const idToken = await user.getIdToken();
    onSuccess({
      uid: user.uid,
      phoneNumber: user.displayName ?? user.email ?? user.uid,
      idToken,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    setError(`Google sign-in failed: ${code || String(e)}`);
  } finally {
    setLoading(false);
  }
}

export default function PhoneAuthModal({ visible, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sessionInfo, setSessionInfo] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendTimer = useCallback(() => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleReset = useCallback(() => {
    setStep("phone");
    setPhoneNumber("");
    setOtp(["", "", "", "", "", ""]);
    setSessionInfo("");
    setError("");
    setLoading(false);
    setResendTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (Platform.OS === "web") resetRecaptchaVerifier();
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleSendOtp = useCallback(async () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 7) { setError("Please enter a valid phone number."); return; }
    setError("");
    setLoading(true);

    const fullPhone = `${countryCode}${digits}`;

    try {
      let recaptchaToken: string | undefined;

      if (Platform.OS === "web") {
        // Get reCAPTCHA token — required by Firebase REST API on web
        resetRecaptchaVerifier();
        const verifier = getRecaptchaVerifier();
        recaptchaToken = await verifier.verify();
      }

      // ── Both web & native: API server proxy ──────────────────────────────
      const res = await fetch(`${API_BASE}/api/auth/phone/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone, recaptchaToken }),
      });
      const data = await res.json() as { sessionInfo?: string; error?: string };
      if (!res.ok || data.error) {
        setError(rawError(data.error ?? "Unknown error"));
        return;
      }
      setSessionInfo(data.sessionInfo ?? "");
      setStep("otp");
      startResendTimer();
    } catch (e: unknown) {
      resetRecaptchaVerifier();
      // Show the raw Firebase error code for debugging
      const code = (e as { code?: string })?.code ?? "";
      const msg  = e instanceof Error ? e.message : String(e);
      const display = code ? `[${code}] ${msg}` : msg;

      if (code === "auth/operation-not-allowed" || msg.includes("OPERATION_NOT_ALLOWED")) {
        setError(`Phone auth blocked by Firebase. Code: ${code || "OPERATION_NOT_ALLOWED"}`);
      } else if (code === "auth/too-many-requests" || msg.includes("TOO_MANY_ATTEMPTS")) {
        setError("Too many attempts. Please wait and try again in 1 hour.");
      } else if (code === "auth/quota-exceeded" || msg.includes("QUOTA_EXCEEDED")) {
        setError("Daily SMS quota exceeded (10/day on free plan). Wait 24h or add billing.");
      } else if (code === "auth/invalid-phone-number" || msg.includes("INVALID_PHONE_NUMBER")) {
        setError("Invalid phone number. Example: 9876543210");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Please check your connection.");
      } else if (code === "auth/captcha-check-failed" || msg.includes("reCAPTCHA")) {
        setError(`reCAPTCHA failed. Try refreshing the page. [${code}]`);
      } else {
        setError(display);
      }
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, countryCode, startResendTimer]);

  const handleVerifyOtp = useCallback(async () => {
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the 6-digit OTP."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/phone/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionInfo, code }),
      });
      const data = await res.json() as {
        uid?: string;
        idToken?: string;
        phoneNumber?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        setError(rawError(data.error ?? "Invalid OTP"));
        return;
      }
      setStep("success");
      setTimeout(() => {
        handleReset();
        onSuccess({ uid: data.uid!, phoneNumber: data.phoneNumber!, idToken: data.idToken! });
      }, 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [otp, sessionInfo, handleReset, onSuccess]);

  const handleOtpChange = useCallback((value: string, index: number) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (!digit && index > 0) otpRefs.current[index - 1]?.focus();
  }, [otp]);

  const handleOtpKeyPress = useCallback((key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={s.backdrop} onPress={handleClose}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />

            {/* Country picker overlay */}
            {showCountryPicker && (
              <View style={s.pickerOverlay}>
                <View style={s.pickerHeader}>
                  <Text style={s.pickerTitle}>Country Code</Text>
                  <Pressable onPress={() => setShowCountryPicker(false)}>
                    <Feather name="x" size={20} color="#aaa" />
                  </Pressable>
                </View>
                {COUNTRY_CODES.map((c) => (
                  <Pressable
                    key={c.code}
                    style={[s.pickerRow, countryCode === c.code && s.pickerRowSelected]}
                    onPress={() => { setCountryCode(c.code); setShowCountryPicker(false); }}
                  >
                    <Text style={s.pickerFlag}>{c.flag}</Text>
                    <Text style={s.pickerName}>{c.name}</Text>
                    <Text style={s.pickerCode}>{c.code}</Text>
                    {countryCode === c.code && <Feather name="check" size={16} color="#E50914" />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* ── Step: Phone Entry ── */}
            {step === "phone" && (
              <>
                <View style={s.iconRow}>
                  <View style={s.iconWrap}>
                    <Ionicons name="phone-portrait-outline" size={26} color="#E50914" />
                  </View>
                </View>
                <Text style={s.title}>Sign In with Phone</Text>
                <Text style={s.subtitle}>We'll send an OTP to your number</Text>

                <View style={s.phoneRow}>
                  <Pressable style={s.countryBtn} onPress={() => setShowCountryPicker(true)}>
                    <Text style={s.countryCode}>{countryCode}</Text>
                    <Feather name="chevron-down" size={14} color="#555" />
                  </Pressable>
                  <TextInput
                    style={s.phoneInput}
                    value={phoneNumber}
                    onChangeText={(t) => { setPhoneNumber(t); setError(""); }}
                    placeholder="Phone number"
                    placeholderTextColor="#444"
                    keyboardType="phone-pad"
                    maxLength={13}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                  />
                </View>

                {!!error && <Text style={s.errorText}>{error}</Text>}

                <Pressable
                  style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.btnText}>Send OTP</Text>}
                </Pressable>

                <Pressable onPress={handleClose} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>

                {Platform.OS === "web" && (
                  <>
                    <View style={s.dividerRow}>
                      <View style={s.dividerLine} />
                      <Text style={s.dividerText}>ya</Text>
                      <View style={s.dividerLine} />
                    </View>
                    <Pressable
                      style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => signInWithGoogle(onSuccess, setError, setLoading)}
                      disabled={loading}
                    >
                      <Text style={s.googleBtnText}>🔵  Google se Sign In karein</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* ── Step: OTP Verification ── */}
            {step === "otp" && (
              <>
                <View style={s.iconRow}>
                  <View style={s.iconWrap}>
                    <Ionicons name="keypad-outline" size={26} color="#E50914" />
                  </View>
                </View>
                <Text style={s.title}>Verify OTP</Text>
                <Text style={s.subtitle}>
                  OTP sent to {countryCode} {phoneNumber}
                </Text>

                <View style={s.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => { otpRefs.current[i] = r; }}
                      style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {!!error && <Text style={s.errorText}>{error}</Text>}

                <Pressable
                  style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.btnText}>Verify OTP</Text>}
                </Pressable>

                <View style={s.resendRow}>
                  {resendTimer > 0 ? (
                    <Text style={s.resendTimer}>Resend in {resendTimer}s</Text>
                  ) : (
                    <Pressable onPress={handleSendOtp}>
                      <Text style={s.resendLink}>Resend OTP</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  onPress={() => { setStep("phone"); setOtp(["","","","","",""]); setError(""); }}
                  style={s.cancelBtn}
                >
                  <Text style={s.cancelText}>← Change Number</Text>
                </Pressable>
              </>
            )}

            {/* ── Step: Success ── */}
            {step === "success" && (
              <View style={s.successWrap}>
                <View style={s.successIcon}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
                <Text style={s.successTitle}>Logged In! 🎬</Text>
                <Text style={s.successSub}>Welcome to S-Movie</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function rawError(raw: string): string {
  return raw; // Show the raw Firebase error as-is for debugging
}

function friendlyError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("operation_not_allowed") || r.includes("operation-not-allowed"))
    return "Phone sign-in is not enabled. Please contact support.";
  if (r.includes("too_many_attempts") || r.includes("too-many-requests"))
    return "Too many attempts. Please wait and try again in 1 hour.";
  if (r.includes("invalid_code") || r.includes("invalid-verification-code"))
    return "Incorrect OTP. Please check and try again.";
  if (r.includes("session_expired") || r.includes("code-expired"))
    return "OTP has expired. Please request a new one.";
  if (r.includes("invalid_phone_number") || r.includes("invalid-phone-number"))
    return "Invalid phone number format. Example: 9876543210";
  if (r.includes("invalid_session_info"))
    return "Session expired. Please request a new OTP.";
  if (r.includes("quota_exceeded"))
    return "SMS quota exceeded. Please try again tomorrow.";
  if (r.includes("network"))
    return "Network error. Please check your connection.";
  return "Something went wrong. Please try again.";
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#222",
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    minHeight: 360,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2a2a2a",
    alignSelf: "center",
    marginBottom: 24,
  },
  iconRow: { alignItems: "center", marginBottom: 14 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(229,9,20,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.2)",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "#555",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 24,
  },

  phoneRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingHorizontal: 12,
    paddingVertical: 14,
    minWidth: 72,
  },
  countryCode: {
    color: "#e5e5e5",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  phoneInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },

  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  otpBoxFilled: {
    borderColor: "#E50914",
    backgroundColor: "rgba(229,9,20,0.08)",
  },

  errorText: {
    color: "#E50914",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 18,
  },

  btn: {
    backgroundColor: "#E50914",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  cancelBtn: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#555", fontSize: 13, fontFamily: "Inter_400Regular" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2a2a2a" },
  dividerText: { color: "#555", fontSize: 12, marginHorizontal: 10, fontFamily: "Inter_400Regular" },
  googleBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  googleBtnText: { color: "#ccc", fontSize: 14, fontFamily: "Inter_500Medium" },

  resendRow: { alignItems: "center", paddingVertical: 8 },
  resendTimer: { color: "#555", fontSize: 12, fontFamily: "Inter_400Regular" },
  resendLink: { color: "#E50914", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  successWrap: { alignItems: "center", paddingVertical: 32, gap: 14 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  successSub: { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular" },

  pickerOverlay: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    backgroundColor: "#141414",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
    zIndex: 100,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  pickerTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  pickerRowSelected: { backgroundColor: "rgba(229,9,20,0.06)" },
  pickerFlag: { fontSize: 20 },
  pickerName: { flex: 1, color: "#e5e5e5", fontSize: 14, fontFamily: "Inter_500Medium" },
  pickerCode: { color: "#555", fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 8 },
});
