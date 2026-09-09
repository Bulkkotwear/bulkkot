/**
 * BULKKOT — Production Auth System
 * Version: 2.0 (Direct OAuth Redirect, Smooth Mode Switch, Zero-Crash)
 */
(() => {
  "use strict";

  const authForm = document.getElementById("authMainForm");
  const tabLogin = document.getElementById("btnTabLogin");
  const tabSignup = document.getElementById("btnTabSignup");
  const modeHeading = document.getElementById("authModeHeading");
  const modeSubtitle = document.getElementById("authModeSubtitle");

  const wrapFullName = document.getElementById("wrapFullName");
  const wrapConfirmPwd = document.getElementById("wrapConfirmPwd");

  const inputFullName = document.getElementById("inputFullName");
  const inputEmail = document.getElementById("inputEmail");
  const inputPassword = document.getElementById("inputPassword");
  const inputConfirmPassword = document.getElementById("inputConfirmPassword");

  const btnSubmit = document.getElementById("btnSubmitAuth");
  const txtSubmit = document.getElementById("txtSubmit");
  const btnGoogle = document.getElementById("btnGoogleAuth");
  const btnForgot = document.getElementById("btnForgotPwd");
  const btnTogglePwd = document.getElementById("btnTogglePwd");

  const bannerFeedback = document.getElementById("authFeedbackBanner");

  let currentMode = "login";
  let supabaseClient = null;

  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const cfg = window.BULKKOT_CONFIG;
    if (!cfg || !window.supabase) {
      showFeedback("Auth service offline. Please try again.", "error");
      return null;
    }
    supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  function setAuthMode(mode) {
    currentMode = mode;
    clearErrors();
    clearFeedback();

    if (mode === "signup") {
      tabLogin.classList.remove("active");
      tabSignup.classList.add("active");
      wrapFullName.style.display = "flex";
      wrapConfirmPwd.style.display = "flex";
      btnForgot.style.visibility = "hidden";
      modeHeading.textContent = "CREATE ACCOUNT";
      modeSubtitle.textContent = "Join BULKKOT VIP to unlock Drop 001 and access priority dispatch.";
      txtSubmit.textContent = "CREATE ACCOUNT";
      inputPassword.autocomplete = "new-password";
    } else {
      tabSignup.classList.remove("active");
      tabLogin.classList.add("active");
      wrapFullName.style.display = "none";
      wrapConfirmPwd.style.display = "none";
      btnForgot.style.visibility = "visible";
      modeHeading.textContent = "SIGN IN";
      modeSubtitle.textContent = "Access your saved dispatch addresses, track shipments live, and secure your silhouettes.";
      txtSubmit.textContent = "SIGN IN";
      inputPassword.autocomplete = "current-password";
    }
  }

  function showFeedback(msg, type = "error") {
    if (!bannerFeedback) return;
    bannerFeedback.textContent = msg;
    bannerFeedback.className = `auth-feedback-banner is-${type}`;
  }

  function clearFeedback() {
    if (!bannerFeedback) return;
    bannerFeedback.textContent = "";
    bannerFeedback.className = "auth-feedback-banner";
  }

  function setError(wrapEl, errSpanId, msg) {
    if (wrapEl) wrapEl.classList.add("has-error");
    const span = document.getElementById(errSpanId);
    if (span) span.textContent = msg;
  }

  function clearErrors() {
    document.querySelectorAll(".form-field-wrap").forEach(w => w.classList.remove("has-error"));
    document.querySelectorAll(".field-error-msg").forEach(s => s.textContent = "");
  }

  function validate() {
    let isValid = true;
    clearErrors();
    clearFeedback();

    const email = inputEmail.value.trim();
    const pwd = inputPassword.value;

    if (currentMode === "signup") {
      const name = inputFullName.value.trim();
      const confirm = inputConfirmPassword.value;

      if (!name || name.length < 2) {
        setError(wrapFullName, "errFullName", "Please enter your full name.");
        isValid = false;
      }

      if (!confirm || confirm !== pwd) {
        setError(wrapConfirmPwd, "errConfirmPwd", "Passwords do not match.");
        isValid = false;
      }
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(inputEmail.closest(".form-field-wrap"), "errEmail", "Please provide a valid email address.");
      isValid = false;
    }

    if (!pwd || pwd.length < 6) {
      setError(inputPassword.closest(".form-field-wrap"), "errPassword", "Password must be at least 6 characters.");
      isValid = false;
    }

    return isValid;
  }

  function setLoading(loading) {
    btnSubmit.disabled = loading;
    btnGoogle.disabled = loading;
    btnSubmit.classList.toggle("is-loading", loading);
  }

  function getRedirectDestination() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/")) return redirect;
    return "./index.html";
  }

  async function handleLogin() {
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: inputEmail.value.trim(),
        password: inputPassword.value
      });

      if (error) throw error;
      showFeedback("Authentication verified. Redirecting...", "success");
      setTimeout(() => {
        window.location.href = getRedirectDestination();
      }, 400);
    } catch (err) {
      showFeedback(err.message || "Invalid credentials. Please verify and retry.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    const supabase = getSupabase();
    if (!supabase) return;

    const name = inputFullName.value.trim();
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });

      if (error) throw error;

      if (data?.user) {
        await supabase.from("customer_profiles").upsert({
          id: data.user.id,
          full_name: name,
          updated_at: new Date().toISOString()
        });
      }

      if (data.user && !data.session) {
        showFeedback("Verification email sent! Please check your inbox.", "success");
        return;
      }

      showFeedback("VIP Account created! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = getRedirectDestination();
      }, 500);
    } catch (err) {
      showFeedback(err.message || "Failed to create account. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  // EVENT LISTENERS
  tabLogin?.addEventListener("click", () => setAuthMode("login"));
  tabSignup?.addEventListener("click", () => setAuthMode("signup"));

  btnTogglePwd?.addEventListener("click", () => {
    const isPwd = inputPassword.type === "password";
    inputPassword.type = isPwd ? "text" : "password";
    if (inputConfirmPassword) inputConfirmPassword.type = isPwd ? "text" : "password";
    btnTogglePwd.textContent = isPwd ? "HIDE" : "SHOW";
  });

  btnGoogle?.addEventListener("click", async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/index.html" }
      });
      if (error) throw error;
    } catch (err) {
      showFeedback(err.message || "Google OAuth failed.");
    }
  });

  btnForgot?.addEventListener("click", async () => {
    const email = inputEmail.value.trim();
    if (!email) {
      setError(inputEmail.closest(".form-field-wrap"), "errEmail", "Enter your registered email first.");
      inputEmail.focus();
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/signin.html"
      });
      if (error) throw error;
      showFeedback("Password reset link sent to your email!", "success");
    } catch (err) {
      showFeedback(err.message || "Unable to send reset email.");
    }
  });

  authForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (currentMode === "signup") await handleSignup();
    else await handleLogin();
  });

  // INITIAL SESSION VERIFICATION
  async function init() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      window.location.href = getRedirectDestination();
    }
  }

  init();
})();
