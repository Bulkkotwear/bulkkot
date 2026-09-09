(() => {
  "use strict";

  const body = document.body;
  const authForm = document.getElementById("authForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const googleBtn = document.getElementById("googleBtn");
  const forgotBtn = document.getElementById("forgotBtn");
  const passwordToggle = document.getElementById("passwordToggle");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const authMessage = document.getElementById("authMessage");

  let mode = "login";
  let supabaseClient = null;

  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const config = window.BULKKOT_CONFIG;
    if (!config || !window.supabase) {
      showMessage("Authentication configuration missing.");
      return null;
    }
    supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  function setMode(nextMode) {
    mode = nextMode;
    clearErrors();
    clearMessage();

    if (mode === "signup") {
      body.classList.add("signup-mode");
      loginTab.classList.remove("active");
      signupTab.classList.add("active");
      authTitle.textContent = "Create account";
      authSubtitle.textContent = "Join BULKKOT and keep your orders in one place.";
      submitText.textContent = "CREATE ACCOUNT";
      passwordInput.autocomplete = "new-password";
    } else {
      body.classList.remove("signup-mode");
      signupTab.classList.remove("active");
      loginTab.classList.add("active");
      authTitle.textContent = "Sign in";
      authSubtitle.textContent = "Access your BULKKOT account and orders.";
      submitText.textContent = "SIGN IN";
      passwordInput.autocomplete = "current-password";
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateForm() {
    let valid = true;
    clearErrors();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmPasswordInput.value;

    if (mode === "signup") {
      if (!name) { setError("nameField", "nameError", "Please enter your name."); valid = false; }
      else if (name.length < 2) { setError("nameField", "nameError", "Name must be at least 2 characters."); valid = false; }
    }

    if (!email) { setError(null, "emailError", "Please enter your email."); valid = false; }
    else if (!validateEmail(email)) { setError(null, "emailError", "Please enter a valid email address."); valid = false; }

    if (!password) { setError(null, "passwordError", "Please enter your password."); valid = false; }
    else if (password.length < 6) { setError(null, "passwordError", "Password must be at least 6 characters."); valid = false; }

    if (mode === "signup") {
      if (!confirm) { setError("confirmField", "confirmError", "Please confirm your password."); valid = false; }
      else if (password !== confirm) { setError("confirmField", "confirmError", "Passwords do not match."); valid = false; }
    }
    return valid;
  }

  function setError(fieldId, errorId, message) {
    if (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) field.classList.add("invalid");
    }
    const error = document.getElementById(errorId);
    if (error) error.textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll(".field").forEach(field => field.classList.remove("invalid"));
    document.querySelectorAll(".field-error").forEach(error => error.textContent = "");
  }

  function showMessage(message, isSuccess = false) {
    authMessage.textContent = message;
    authMessage.style.color = isSuccess ? '#80c890' : '#e87c81';
    authMessage.style.backgroundColor = isSuccess ? 'rgba(49,196,141,.06)' : 'rgba(227,38,46,.06)';
    authMessage.style.borderColor = isSuccess ? 'rgba(49,196,141,.3)' : 'rgba(227,38,46,.3)';
    authMessage.classList.add("show");
  }

  function clearMessage() {
    authMessage.textContent = "";
    authMessage.classList.remove("show");
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    googleBtn.disabled = loading;
    submitBtn.classList.toggle("loading", loading);
  }

  async function login() {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    clearMessage();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Unable to create login session.");
      showMessage("Signed in successfully.", true);
      await handleSuccessfulAuth(data.user);
    } catch (error) {
      showMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function signup() {
    const supabase = getSupabase();
    if (!supabase) return;
    const name = nameInput.value.trim();
    setLoading(true);
    clearMessage();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailInput.value.trim(),
        password: passwordInput.value,
        options: { data: { full_name: name } }
      });
      if (error) throw error;
      
      if (data?.user) {
        await supabase.from('customer_profiles').upsert({
          id: data.user.id,
          full_name: name,
          updated_at: new Date().toISOString()
        });
      }

      if (data.user && !data.session) {
        showMessage("Account created. Please check your email to confirm your account.", true);
        return;
      }
      if (data.user) await handleSuccessfulAuth(data.user);
    } catch (error) {
      showMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    const supabase = getSupabase();
    if (!supabase) return;
    googleBtn.disabled = true;
    clearMessage();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + '/index.html' }
      });
      if (error) throw error;
    } catch (error) {
      showMessage(friendlyAuthError(error));
      googleBtn.disabled = false;
    }
  }

  async function forgotPassword() {
    const supabase = getSupabase();
    if (!supabase) return;
    const email = emailInput.value.trim();
    if (!email) { setError(null, "emailError", "Enter your email first."); emailInput.focus(); return; }
    if (!validateEmail(email)) { setError(null, "emailError", "Enter a valid email address."); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });
      if (error) throw error;
      showMessage("Password reset instructions have been sent to your email.", true);
    } catch (error) {
      showMessage(friendlyAuthError(error));
    }
  }

  async function handleSuccessfulAuth(user) {
    setTimeout(() => {
      window.location.href = getRedirectDestination();
    }, 500);
  }

  function getRedirectDestination() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/")) return redirect;
    return "./index.html";
  }

  function friendlyAuthError(error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
    if (message.includes("email not confirmed")) return "Please confirm your email before signing in.";
    if (message.includes("user already registered")) return "An account with this email already exists. Try signing in.";
    if (message.includes("password should be at least")) return "Your password is too short.";
    if (message.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
    return error?.message || "Something went wrong. Please try again.";
  }

  passwordToggle.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    passwordToggle.textContent = isPassword ? "HIDE" : "SHOW";
  });

  loginTab.addEventListener("click", () => setMode("login"));
  signupTab.addEventListener("click", () => setMode("signup"));
  googleBtn.addEventListener("click", googleLogin);
  forgotBtn.addEventListener("click", forgotPassword);

  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateForm()) return;
    if (mode === "signup") await signup();
    else await login();
  });

  async function init() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      window.location.href = getRedirectDestination();
      return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await handleSuccessfulAuth(session.user);
      }
    });
  }

  init();
})();
