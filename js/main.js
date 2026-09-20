/**
 * BULKKOT — Main Storefront Engine
 * Production Hardened
 *
 * Responsibilities:
 * - Global storefront state
 * - Mobile drawer
 * - Header/search interactions
 * - Editorial carousel
 * - Auth/account UI
 * - Customer profile/order history
 * - CMS/store settings sync
 * - Policy/About/Size Guide/Tracking modals
 * - Keyboard + accessibility handling
 * - Global scroll-lock safety
 *
 * Product/catalog/cart ownership:
 * - shop.html owns its catalogue renderer
 * - product.html owns its PDP
 * - js/cart.js owns cart state
 *
 * Visual identity intentionally preserved.
 */

(function () {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const SUPABASE_URL =
    "https://pgubjluqgqvrybvehzeh.supabase.co";

  const SUPABASE_ANON_KEY =
    "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const FALLBACK_IMAGE =
    "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";

  const STORAGE_KEYS = {
    welcomeSeen: "bulkkot_welcome_seen"
  };

  const supabase =
    window.supabase &&
    typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY
        )
      : null;

  window.bulkkotSupabase = supabase;

  /* =========================================================
     GLOBAL STATE
     ========================================================= */

  const state = {
    initialized: false,
    drawerOpen: false,
    activeModal: null,
    searchOpen: false,
    editorialIndex: 0,
    editorialTimer: null,
    authSubscription: null,
    bodyLockCount: 0
  };

  /* =========================================================
     CONSTANTS
     ========================================================= */

  const SIZES = ["S", "M", "L", "XL"];

  const ANNOUNCEMENT_DEFAULTS = {
    announcement_bg: "#e31b23",
    announcement_color: "#ffffff",
    announcement_font: "'Inter', sans-serif",
    announcement_speed: "20"
  };

  const HERO_DEFAULTS = {
    hero_overlay_color: "#000000",
    hero_text_color: "#ffffff",
    hero_font: "'Montserrat', sans-serif"
  };

  const POLICY_DATA = {
    faq: {
      title: "FREQUENTLY ASKED QUESTIONS",
      content: `
        <h3>HOW DOES DROP 001 WORK?</h3>
        <p>
          Drop 001 consists of limited-quantity heavyweight
          silhouettes. Once sold out, silhouettes may not be
          restocked immediately.
        </p>

        <h3>WHAT ARE THE SHIPPING CHARGES?</h3>
        <p>
          Shipping charges are calculated at checkout based
          on the current order value and available promotions.
        </p>

        <h3>WHAT PAYMENT METHODS DO YOU ACCEPT?</h3>
        <p>
          Available payment methods are shown during checkout.
        </p>
      `
    },

    shipping: {
      title: "SHIPPING POLICY",
      content: `
        <h3>DISPATCH TIMELINE</h3>
        <p>
          Orders are prepared for dispatch according to
          current fulfilment availability.
        </p>

        <h3>DELIVERY TIMELINE</h3>
        <p>
          Delivery timelines depend on destination,
          courier service and serviceability.
        </p>

        <h3>REAL-TIME TRACKING</h3>
        <p>
          Use the Track Order option with your Order Number
          and registered phone number.
        </p>
      `
    },

    returns: {
      title: "RETURNS & EXCHANGES",
      content: `
        <h3>EXCHANGE WINDOW</h3>
        <p>
          Size exchanges are subject to the current
          exchange policy and stock availability.
        </p>

        <h3>CONDITION</h3>
        <p>
          Items must satisfy the applicable return/exchange
          conditions and retain their original tags and packaging.
        </p>

        <h3>HOW TO INITIATE</h3>
        <p>
          Contact BULKKOT through the support channel listed
          on the website with your Order Number.
        </p>
      `
    },

    privacy: {
      title: "PRIVACY POLICY",
      content: `
        <h3>DATA COLLECTION</h3>
        <p>
          Information such as name, phone, email and shipping
          details may be collected when required to provide
          store services.
        </p>

        <h3>SECURITY</h3>
        <p>
          Store data is handled through the configured
          Supabase infrastructure and applicable security rules.
        </p>
      `
    },

    terms: {
      title: "TERMS & CONDITIONS",
      content: `
        <h3>PRODUCTS</h3>
        <p>
          Product availability, pricing and specifications
          are subject to the information displayed on the store.
        </p>

        <h3>CANCELLATION</h3>
        <p>
          Cancellation availability depends on the current
          order fulfilment status.
        </p>
      `
    }
  };

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function on(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPrice(value) {
    return (
      "₹" +
      Number(value || 0).toLocaleString("en-IN")
    );
  }

  function getStock(product, size) {
    return Math.max(
      0,
      Number(product?.stock?.[size] || 0)
    );
  }

  function getTotalStock(product) {
    return SIZES.reduce(
      (total, size) =>
        total + getStock(product, size),
      0
    );
  }

  function getProductImages(product) {
    if (
      Array.isArray(product?.images) &&
      product.images.length
    ) {
      const images = product.images.filter(Boolean);

      if (images.length) return images;
    }

    if (product?.image_url) {
      return [product.image_url];
    }

    return [FALLBACK_IMAGE];
  }

  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage may be unavailable/private mode. */
    }
  }

  /* =========================================================
     BODY SCROLL LOCK
     ========================================================= */

  function lockBodyScroll() {
    state.bodyLockCount += 1;

    document.body.classList.add("modal-open");
  }

  function unlockBodyScroll() {
    state.bodyLockCount =
      Math.max(0, state.bodyLockCount - 1);

    if (state.bodyLockCount === 0) {
      document.body.classList.remove("modal-open");
    }
  }

  function forceUnlockBodyScroll() {
    state.bodyLockCount = 0;
    document.body.classList.remove("modal-open");
  }

  /* =========================================================
     MOBILE DRAWER
     ========================================================= */

  function initMobileDrawer() {
    const drawer =
      $("[data-mobile-drawer]");

    const overlay =
      $("[data-mobile-overlay]");

    const openButtons =
      $$("[data-open-drawer]");

    const closeButtons =
      $$("[data-close-drawer]");

    if (
      !drawer &&
      !overlay &&
      !openButtons.length
    ) {
      return;
    }

    function openDrawer() {
      if (state.drawerOpen) return;

      state.drawerOpen = true;

      drawer?.classList.add("is-open");
      drawer?.setAttribute("aria-hidden", "false");

      overlay?.classList.add("is-active");
      overlay?.setAttribute("aria-hidden", "false");

      lockBodyScroll();
    }

    function closeDrawer() {
      if (!state.drawerOpen) return;

      state.drawerOpen = false;

      drawer?.classList.remove("is-open");
      drawer?.setAttribute("aria-hidden", "true");

      overlay?.classList.remove("is-active");
      overlay?.setAttribute("aria-hidden", "true");

      unlockBodyScroll();
    }

    window.BULKKOT_UI = window.BULKKOT_UI || {};

    window.BULKKOT_UI.openDrawer = openDrawer;
    window.BULKKOT_UI.closeDrawer = closeDrawer;

    openButtons.forEach((button) => {
      on(button, "click", (event) => {
        event.preventDefault();
        openDrawer();
      });
    });

    closeButtons.forEach((button) => {
      on(button, "click", (event) => {
        event.preventDefault();
        closeDrawer();
      });
    });

    on(overlay, "click", closeDrawer);

    /* Close drawer after navigation. */
    $$("[data-mobile-drawer] a").forEach((link) => {
      on(link, "click", () => {
        closeDrawer();
      });
    });

    /* Keep drawer sane if viewport changes to desktop. */
    let lastDesktopState =
      window.matchMedia("(min-width: 768px)").matches;

    const handleResize = () => {
      const desktop =
        window.matchMedia("(min-width: 768px)").matches;

      if (desktop && !lastDesktopState) {
        closeDrawer();
      }

      lastDesktopState = desktop;
    };

    on(window, "resize", handleResize, {
      passive: true
    });
  }

  /* =========================================================
     HEADER SEARCH
     ========================================================= */

  function initHeaderSearch() {
    const toggle =
      $("#headerSearchToggle");

    const bar =
      $("#headerSearchBar");

    const close =
      $("#headerSearchClose");

    const input =
      $("#liveSearchInput");

    if (!toggle && !bar && !input) {
      return;
    }

    function openSearch() {
      if (!bar) return;

      state.searchOpen = true;

      bar.classList.add("is-active");
      bar.setAttribute("aria-hidden", "false");

      window.setTimeout(() => {
        input?.focus();
      }, 50);
    }

    function closeSearch(clear = true) {
      state.searchOpen = false;

      bar?.classList.remove("is-active");
      bar?.setAttribute("aria-hidden", "true");

      if (clear && input) {
        input.value = "";
      }

      document.dispatchEvent(
        new CustomEvent("bulkkot:search-change", {
          detail: {
            query: clear ? "" : input?.value || ""
          }
        })
      );
    }

    on(toggle, "click", (event) => {
      event.preventDefault();

      if (state.searchOpen) {
        closeSearch(false);
      } else {
        openSearch();
      }
    });

    on(close, "click", (event) => {
      event.preventDefault();
      closeSearch(true);
    });

    on(input, "input", (event) => {
      const query =
        String(event.target.value || "")
          .trim();

      document.dispatchEvent(
        new CustomEvent("bulkkot:search-change", {
          detail: {
            query
          }
        })
      );
    });

    on(input, "keydown", (event) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closeSearch(false);
    });

    $$("[data-search-tag]").forEach((button) => {
      on(button, "click", () => {
        const value =
          String(
            button.dataset.searchTag || ""
          ).trim();

        if (input) {
          input.value = value;
        }

        if (!state.searchOpen) {
          openSearch();
        }

        document.dispatchEvent(
          new CustomEvent("bulkkot:search-change", {
            detail: {
              query: value
            }
          })
        );

        $("#shop")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });

    window.BULKKOT_UI =
      window.BULKKOT_UI || {};

    window.BULKKOT_UI.openSearch = openSearch;
    window.BULKKOT_UI.closeSearch = closeSearch;
  }

  /* =========================================================
     EDITORIAL CAROUSEL
     ========================================================= */

  function initEditorialCarousel() {
    const container =
      $("#editorialCarousel");

    if (!container) return;

    const slides =
      $$("[data-slide]", container);

    const indicators =
      $$("[data-slide-indicator]", container);

    const prev =
      $("[data-carousel-prev]", container);

    const next =
      $("[data-carousel-next]", container);

    if (!slides.length) return;

    let current = 0;

    function normalize(index) {
      return (
        (index + slides.length) %
        slides.length
      );
    }

    function render(index) {
      current = normalize(index);

      slides.forEach((slide, index) => {
        const active =
          index === current;

        slide.classList.toggle(
          "is-active",
          active
        );

        slide.setAttribute(
          "aria-hidden",
          active ? "false" : "true"
        );
      });

      indicators.forEach((indicator, index) => {
        const active =
          index === current;

        indicator.classList.toggle(
          "is-active",
          active
        );

        indicator.setAttribute(
          "aria-selected",
          active ? "true" : "false"
        );

        indicator.setAttribute(
          "tabindex",
          active ? "0" : "-1"
        );
      });
    }

    function stop() {
      if (state.editorialTimer) {
        window.clearInterval(
          state.editorialTimer
        );

        state.editorialTimer = null;
      }
    }

    function start() {
      stop();

      if (
        slides.length < 2 ||
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
      ) {
        return;
      }

      state.editorialTimer =
        window.setInterval(() => {
          render(current + 1);
        }, 5000);
    }

    function goNext() {
      render(current + 1);
      start();
    }

    function goPrev() {
      render(current - 1);
      start();
    }

    on(next, "click", (event) => {
      event.preventDefault();
      goNext();
    });

    on(prev, "click", (event) => {
      event.preventDefault();
      goPrev();
    });

    indicators.forEach(
      (indicator, index) => {
        on(indicator, "click", (event) => {
          event.preventDefault();
          render(index);
          start();
        });
      }
    );

    let startX = 0;
    let startY = 0;

    on(
      container,
      "touchstart",
      (event) => {
        const touch =
          event.changedTouches?.[0];

        if (!touch) return;

        startX = touch.clientX;
        startY = touch.clientY;

        stop();
      },
      { passive: true }
    );

    on(
      container,
      "touchend",
      (event) => {
        const touch =
          event.changedTouches?.[0];

        if (!touch) return;

        const dx =
          touch.clientX - startX;

        const dy =
          touch.clientY - startY;

        /* Ignore vertical scrolling gestures. */
        if (
          Math.abs(dx) > 50 &&
          Math.abs(dx) > Math.abs(dy)
        ) {
          if (dx < 0) {
            render(current + 1);
          } else {
            render(current - 1);
          }
        }

        start();
      },
      { passive: true }
    );

    on(container, "mouseenter", stop);
    on(container, "mouseleave", start);
    on(container, "focusin", stop);
    on(container, "focusout", () => {
      window.setTimeout(() => {
        if (
          !container.contains(
            document.activeElement
          )
        ) {
          start();
        }
      }, 0);
    });

    render(0);
    start();
  }

  /* =========================================================
     WELCOME POPUP
     ========================================================= */

  function initWelcomePopup() {
    const popup =
      $("#welcomePopupModal");

    if (!popup) return;

    const close =
      $("#welcomePopupClose");

    const google =
      $("#welcomeGoogleBtn");

    const email =
      $("#welcomeEmailBtn");

    let timer = null;

    const alreadySeen =
      safeLocalStorageGet(
        STORAGE_KEYS.welcomeSeen
      );

    function closePopup() {
      popup.classList.remove(
        "is-open"
      );

      popup.setAttribute(
        "aria-hidden",
        "true"
      );

      safeLocalStorageSet(
        STORAGE_KEYS.welcomeSeen,
        "true"
      );
    }

    if (!alreadySeen) {
      timer = window.setTimeout(() => {
        popup.classList.add(
          "is-open"
        );

        popup.setAttribute(
          "aria-hidden",
          "false"
        );
      }, 1500);
    }

    on(close, "click", closePopup);

    on(popup, "click", (event) => {
      if (event.target === popup) {
        closePopup();
      }
    });

    on(google, "click", async () => {
      closePopup();

      if (!supabase) return;

      try {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              window.location.origin +
              window.location.pathname
          }
        });
      } catch (error) {
        console.error(
          "BULKKOT Google auth failed:",
          error
        );
      }
    });

    on(email, "click", () => {
      closePopup();

      const account =
        $("[data-account-modal]");

      if (!account) return;

      account.classList.add(
        "is-open"
      );

      account.setAttribute(
        "aria-hidden",
        "false"
      );

      lockBodyScroll();
    });

    window.addEventListener(
      "beforeunload",
      () => {
        if (timer) {
          window.clearTimeout(timer);
        }
      },
      { once: true }
    );
  }

  /* =========================================================
     AUTH
     ========================================================= */

  async function initAuth() {
    if (!supabase) return;

    const accountModal =
      $("[data-account-modal]");

    const loginForm =
      $("[data-account-login-form]");

    const signupToggle =
      $("[data-account-signup-toggle]");

    const googleButton =
      $("[data-google-login]");

    const signoutButton =
      $("[data-account-signout]");

    const profileForm =
      $("[data-account-profile-form]");

    const authMessage =
      $("#authInlineError");

    const modeText =
      $("#auth-mode-text");

    const nameField =
      $("#account-name-field");

    const nameInput =
      $("#account-name-input");

    function setAuthMessage(
      message,
      type = "error"
    ) {
      if (!authMessage) return;

      authMessage.textContent =
        message || "";

      authMessage.style.color =
        type === "success"
          ? "#31c48d"
          : "#ff7777";
    }

    function setLoginMode(mode) {
      if (!loginForm) return;

      const signup =
        mode === "signup";

      loginForm.dataset.mode =
        signup
          ? "signup"
          : "signin";

      if (nameField) {
        nameField.style.display =
          signup ? "flex" : "none";
      }

      if (nameInput) {
        if (signup) {
          nameInput.setAttribute(
            "required",
            "true"
          );
        } else {
          nameInput.removeAttribute(
            "required"
          );
        }
      }

      const submit =
        $(".account-submit", loginForm);

      if (modeText) {
        modeText.innerHTML =
          signup
            ? "Create Account"
            : 'Login <span style="font-weight:400;font-size:18px;">or</span> Signup';
      }

      if (submit) {
        submit.textContent =
          signup
            ? "CREATE ACCOUNT"
            : "CONTINUE";
      }

      if (signupToggle) {
        signupToggle.innerHTML =
          signup
            ? "Already have an account? <strong>Login here</strong>"
            : "New to BULKKOT? <strong>Create an account</strong>";
      }

      setAuthMessage("");
    }

    async function updateAuthUI(user) {
      const accountLabel =
        $("[data-account-label]");

      const authView =
        $("[data-account-auth]");

      const userView =
        $("[data-account-user]");

      const emailView =
        $("[data-account-user-email]");

      if (!user) {
        if (accountLabel) {
          accountLabel.textContent =
            "ACCOUNT";
        }

        if (authView) {
          authView.hidden = false;
        }

        if (userView) {
          userView.hidden = true;
        }

        if (emailView) {
          emailView.textContent = "";
        }

        return;
      }

      const metadata =
        user.user_metadata || {};

      const displayName =
        metadata.full_name ||
        user.email?.split("@")[0] ||
        "ACCOUNT";

      if (accountLabel) {
        accountLabel.textContent =
          String(displayName).toUpperCase();
      }

      if (authView) {
        authView.hidden = true;
      }

      if (userView) {
        userView.hidden = false;
      }

      if (emailView) {
        emailView.textContent =
          user.email || "";
      }

      await Promise.allSettled([
        loadCustomerProfile(user.id),
        loadCustomerOrders(user.id)
      ]);
    }

    async function refreshAuthUI() {
      try {
        const {
          data,
          error
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        await updateAuthUI(
          data?.user || null
        );
      } catch (error) {
        console.warn(
          "BULKKOT auth state refresh failed:",
          error
        );

        await updateAuthUI(null);
      }
    }

    /* Supabase auth subscription. */
    const subscription =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          /*
           * Do not perform heavy Supabase queries
           * synchronously inside the auth callback.
           */
          window.setTimeout(() => {
            updateAuthUI(
              session?.user || null
            );

            if (
              window.BULKKOT_CART &&
              typeof window.BULKKOT_CART.renderCart ===
                "function"
            ) {
              window.BULKKOT_CART.renderCart();
            }
          }, 0);
        }
      );

    state.authSubscription =
      subscription?.data?.subscription ||
      null;

    on(
      signupToggle,
      "click",
      (event) => {
        event.preventDefault();

        const mode =
          loginForm?.dataset.mode ||
          "signin";

        setLoginMode(
          mode === "signup"
            ? "signin"
            : "signup"
        );
      }
    );

    on(
      loginForm,
      "submit",
      async (event) => {
        event.preventDefault();

        if (!supabase || !loginForm) {
          return;
        }

        const email =
          $("#account-email", loginForm)
            ?.value
            .trim();

        const password =
          $("#account-password", loginForm)
            ?.value || "";

        const fullName =
          nameInput?.value.trim() || "";

        const isSignup =
          loginForm.dataset.mode ===
          "signup";

        if (
          !email ||
          !password ||
          (isSignup && !fullName)
        ) {
          setAuthMessage(
            "Please fill in all required fields."
          );
          return;
        }

        const submit =
          $(".account-submit", loginForm);

        if (submit) {
          submit.disabled = true;
          submit.textContent =
            "PROCESSING...";
        }

        setAuthMessage("");

        try {
          if (isSignup) {
            const {
              data,
              error
            } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName
                }
              }
            });

            if (error) {
              throw error;
            }

            if (data?.user) {
              /*
               * Profile creation is best-effort.
               * Auth creation should not be reported
               * as failed merely because profile RLS
               * blocks this optional write.
               */
              try {
                await supabase
                  .from("customer_profiles")
                  .upsert({
                    id: data.user.id,
                    full_name: fullName,
                    updated_at:
                      new Date().toISOString()
                  });
              } catch (profileError) {
                console.warn(
                  "Customer profile creation skipped:",
                  profileError
                );
              }
            }

            setAuthMessage(
              data?.session
                ? "Account created successfully!"
                : "Account created. Check your email if verification is required.",
              "success"
            );

            if (data?.session) {
              window.setTimeout(
                () => {
                  closeModal(
                    accountModal
                  );
                },
                500
              );
            }
          } else {
            const {
              error
            } =
              await supabase.auth.signInWithPassword({
                email,
                password
              });

            if (error) {
              throw error;
            }

            closeModal(accountModal);
          }
        } catch (error) {
          setAuthMessage(
            error?.message ||
              "Authentication failed."
          );
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.textContent =
              isSignup
                ? "CREATE ACCOUNT"
                : "CONTINUE";
          }
        }
      }
    );

    on(
      googleButton,
      "click",
      async (event) => {
        event.preventDefault();

        if (!supabase) return;

        try {
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo:
                window.location.origin +
                window.location.pathname
            }
          });
        } catch (error) {
          setAuthMessage(
            error?.message ||
              "Google sign-in failed."
          );
        }
      }
    );

    on(
      signoutButton,
      "click",
      async (event) => {
        event.preventDefault();

        if (!supabase) return;

        const originalText =
          signoutButton.textContent;

        signoutButton.disabled = true;
        signoutButton.textContent =
          "SIGNING OUT...";

        try {
          const {
            error
          } =
            await supabase.auth.signOut();

          if (error) {
            throw error;
          }

          closeModal(accountModal);
        } catch (error) {
          setAuthMessage(
            error?.message ||
              "Unable to sign out."
          );
        } finally {
          signoutButton.disabled =
            false;

          signoutButton.textContent =
            originalText || "SIGN OUT";
        }
      }
    );

    on(
      profileForm,
      "submit",
      async (event) => {
        event.preventDefault();

        if (!supabase || !profileForm) {
          return;
        }

        try {
          const {
            data
          } =
            await supabase.auth.getUser();

          const user =
            data?.user;

          if (!user) {
            return;
          }

          const button =
            $("button[type='submit']", profileForm) ||
            $("button", profileForm);

          const message =
            $("[data-profile-message]");

          if (button) {
            button.disabled = true;
            button.textContent =
              "SAVING...";
          }

          const profileData = {
            id: user.id,
            full_name:
              $("#account-name", profileForm)
                ?.value.trim() || "",
            phone:
              $("#account-phone", profileForm)
                ?.value.trim() || "",
            shipping_address:
              $("#account-address", profileForm)
                ?.value.trim() || "",
            shipping_city:
              $("#account-city", profileForm)
                ?.value.trim() || "",
            shipping_state:
              $("#account-state", profileForm)
                ?.value.trim() || "",
            shipping_pincode:
              $("#account-pincode", profileForm)
                ?.value.trim() || "",
            updated_at:
              new Date().toISOString()
          };

          const {
            error
          } = await supabase
            .from("customer_profiles")
            .upsert(profileData);

          if (error) {
            throw error;
          }

          if (message) {
            message.textContent =
              "Profile saved successfully!";
            message.style.color =
              "#31c48d";
          }

          window.setTimeout(() => {
            if (message) {
              message.textContent = "";
            }
          }, 3000);
        } catch (error) {
          const message =
            $("[data-profile-message]");

          if (message) {
            message.textContent =
              error?.message ||
              "Failed to save profile.";
            message.style.color =
              "#ff7777";
          }
        } finally {
          const button =
            $("button[type='submit']", profileForm) ||
            $("button", profileForm);

          if (button) {
            button.disabled = false;
            button.textContent =
              "SAVE PROFILE";
          }
        }
      }
    );

    await refreshAuthUI();
  }

  /* =========================================================
     CUSTOMER PROFILE
     ========================================================= */

  async function loadCustomerProfile(userId) {
    if (!supabase || !userId) return;

    try {
      const {
        data,
        error
      } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) return;

      const form =
        $("[data-account-profile-form]");

      if (!form) return;

      const fields = {
        "#account-name":
          data.full_name || "",

        "#account-phone":
          data.phone || "",

        "#account-address":
          data.shipping_address || "",

        "#account-city":
          data.shipping_city || "",

        "#account-state":
          data.shipping_state || "",

        "#account-pincode":
          data.shipping_pincode || ""
      };

      Object.entries(fields).forEach(
        ([selector, value]) => {
          const field =
            $(selector, form);

          if (field) {
            field.value = value;
          }
        }
      );
    } catch (error) {
      console.warn(
        "BULKKOT profile load failed:",
        error
      );
    }
  }

  /* =========================================================
     CUSTOMER ORDERS
     ========================================================= */

  async function loadCustomerOrders(userId) {
    const box =
      $("[data-account-orders]");

    if (!supabase || !box || !userId) {
      return;
    }

    try {
      const {
        data,
        error
      } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order(
          "created_at",
          { ascending: false }
        );

      if (error) {
        throw error;
      }

      if (!Array.isArray(data) || !data.length) {
        box.innerHTML = `
          <p style="
            color:#777;
            font-size:12px;
            margin:10px 0;
          ">
            No past orders found.
          </p>
        `;
        return;
      }

      box.innerHTML =
        data.map((order) => {
          const id =
            order.order_number ||
            order.id?.slice?.(0, 8) ||
            "ORDER";

          const status =
            order.order_status ||
            "PLACED";

          return `
            <div
              style="
                border:1px solid #222;
                border-radius:6px;
                padding:10px;
                margin-bottom:8px;
                background:#0c0c0c;
              "
            >
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:10px;
                  font-size:12px;
                  font-weight:700;
                "
              >
                <span>
                  ${escapeHTML(id)}
                </span>

                <span
                  style="
                    color:var(--bk-red,#e31b23);
                  "
                >
                  ${escapeHTML(status)}
                </span>
              </div>

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:10px;
                  font-size:11px;
                  color:#888;
                  margin-top:4px;
                "
              >
                <span>
                  ${
                    order.created_at
                      ? new Date(
                          order.created_at
                        ).toLocaleDateString(
                          "en-IN"
                        )
                      : ""
                  }
                </span>

                <strong>
                  ${formatPrice(order.total)}
                </strong>
              </div>
            </div>
          `;
        }).join("");
    } catch (error) {
      console.warn(
        "BULKKOT order history load failed:",
        error
      );

      box.innerHTML = `
        <p style="
          color:#777;
          font-size:12px;
        ">
          Failed to load order history.
        </p>
      `;
    }
  }

  /* =========================================================
     STORE SETTINGS
     ========================================================= */

  async function syncStoreSettings() {
    if (!supabase) return;

    try {
      const {
        data,
        error
      } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error || !data) return;

      const phone =
        String(
          data.support_phone || ""
        ).replace(/\D/g, "");

      if (phone) {
        $$(".whatsapp-float").forEach(
          (button) => {
            button.href =
              `https://wa.me/${phone}?text=${encodeURIComponent(
                "Hi BULKKOT, I have an inquiry about Drop 001."
              )}`;
          }
        );
      }

      if (data.support_email) {
        $$('a[href^="mailto:"]').forEach(
          (link) => {
            link.href =
              `mailto:${data.support_email}`;
          }
        );
      }
    } catch (error) {
      console.warn(
        "BULKKOT store settings sync failed:",
        error
      );
    }
  }

  /* =========================================================
     CMS CONTENT
     ========================================================= */

  function hexToRgba(hex, alpha) {
    const clean =
      String(hex || "")
        .replace("#", "")
        .trim();

    if (
      !/^[0-9a-fA-F]{6}$/.test(clean)
    ) {
      return `rgba(0,0,0,${alpha})`;
    }

    const r =
      parseInt(
        clean.slice(0, 2),
        16
      );

    const g =
      parseInt(
        clean.slice(2, 4),
        16
      );

    const b =
      parseInt(
        clean.slice(4, 6),
        16
      );

    return `rgba(${r},${g},${b},${alpha})`;
  }

  async function loadCMSContent() {
    if (!supabase) return;

    try {
      const {
        data,
        error
      } = await supabase
        .from("site_content")
        .select(
          "key,value,content_key,content_value"
        );

      if (error || !Array.isArray(data)) {
        return;
      }

      const lookup = {};

      data.forEach((row) => {
        const key =
          row.content_key ||
          row.key;

        if (!key) return;

        lookup[key] =
          row.content_value ??
          row.value ??
          "";
      });

      /* -----------------------------------------------------
         Announcement
         ----------------------------------------------------- */

      const announcementBar =
        $(".announcement-bar");

      const announcementTrack =
        $(".announcement-track");

      const announcementBg =
        lookup.announcement_bg ||
        ANNOUNCEMENT_DEFAULTS.announcement_bg;

      const announcementColor =
        lookup.announcement_color ||
        ANNOUNCEMENT_DEFAULTS.announcement_color;

      const announcementFont =
        lookup.announcement_font ||
        ANNOUNCEMENT_DEFAULTS.announcement_font;

      const announcementSpeed =
        lookup.announcement_speed ||
        ANNOUNCEMENT_DEFAULTS.announcement_speed;

      if (announcementBar) {
        announcementBar.style.backgroundColor =
          announcementBg;

        announcementBar.style.color =
          announcementColor;

        announcementBar.style.fontFamily =
          announcementFont;
      }

      if (announcementTrack) {
        const numericSpeed =
          Number(announcementSpeed);

        if (
          Number.isFinite(numericSpeed) &&
          numericSpeed > 0
        ) {
          announcementTrack.style.animationDuration =
            `${numericSpeed}s`;
        }
      }

      /* -----------------------------------------------------
         Hero
         ----------------------------------------------------- */

      const hero =
        $(".hero");

      if (hero) {
        const overlayColor =
          lookup.hero_overlay_color ||
          HERO_DEFAULTS.hero_overlay_color;

        const heroTextColor =
          lookup.hero_text_color ||
          HERO_DEFAULTS.hero_text_color;

        const heroFont =
          lookup.hero_font ||
          HERO_DEFAULTS.hero_font;

        hero.style.setProperty(
          "--hero-overlay-color",
          overlayColor
        );

        hero.style.setProperty(
          "--hero-overlay",
          hexToRgba(
            overlayColor,
            0.42
          )
        );

        hero.style.setProperty(
          "--hero-text-color",
          heroTextColor
        );

        hero.style.setProperty(
          "--hero-font",
          heroFont
        );
      }

      /*
       * Generic text/content CMS hooks.
       * Existing HTML can opt into these without
       * requiring another JS bundle.
       */
      $$("[data-cms-key]").forEach(
        (element) => {
          const key =
            element.dataset.cmsKey;

          if (!key) return;

          if (
            Object.prototype.hasOwnProperty.call(
              lookup,
              key
            )
          ) {
            const value =
              String(
                lookup[key] ?? ""
              );

            if (
              element.dataset.cmsHtml ===
              "true"
            ) {
              element.innerHTML = value;
            } else {
              element.textContent = value;
            }
          }
        }
      );
    } catch (error) {
      console.warn(
        "BULKKOT CMS sync failed:",
        error
      );
    }
  }

  /* =========================================================
     MODAL CORE
     ========================================================= */

  function openModal(modal) {
    if (!modal) return;

    if (
      modal.classList.contains(
        "is-open"
      )
    ) {
      return;
    }

    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    state.activeModal = modal;

    lockBodyScroll();
  }

  function closeModal(modal) {
    if (!modal) return;

    if (
      !modal.classList.contains(
        "is-open"
      )
    ) {
      return;
    }

    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    if (state.activeModal === modal) {
      state.activeModal = null;
    }

    unlockBodyScroll();
  }

  function bindModalBackdrop(
    modal,
    closeHandler
  ) {
    on(modal, "click", (event) => {
      if (event.target === modal) {
        closeHandler();
      }
    });
  }

  /* =========================================================
     POLICY MODAL
     ========================================================= */

  function initPolicyModal() {
    const modal =
      $("[data-policy-modal]");

    if (!modal) return;

    const title =
      $("[data-policy-title]", modal);

    const content =
      $("[data-policy-content]", modal);

    const closeButtons =
      $$("[data-close-policy]", modal);

    function close() {
      closeModal(modal);
    }

    function open(type) {
      const policy =
        POLICY_DATA[type] ||
        {
          title: "INFORMATION",
          content:
            "<p>Information coming soon.</p>"
        };

      if (title) {
        title.textContent =
          policy.title;
      }

      if (content) {
        content.innerHTML =
          policy.content;
      }

      openModal(modal);
    }

    $$("[data-open-policy]").forEach(
      (button) => {
        on(button, "click", (event) => {
          event.preventDefault();

          open(
            button.dataset.openPolicy
          );
        });
      }
    );

    closeButtons.forEach(
      (button) => {
        on(button, "click", close);
      }
    );

    bindModalBackdrop(
      modal,
      close
    );
  }

  /* =========================================================
     ABOUT MODAL
     ========================================================= */

  function initAboutModal() {
    const modal =
      $("[data-about-modal]");

    if (!modal) return;

    const openButtons =
      $$("[data-open-about]");

    const closeButtons =
      $$("[data-close-about]", modal);

    const close = () =>
      closeModal(modal);

    openButtons.forEach(
      (button) => {
        on(button, "click", (event) => {
          event.preventDefault();
          openModal(modal);
        });
      }
    );

    closeButtons.forEach(
      (button) => {
        on(button, "click", close);
      }
    );

    bindModalBackdrop(
      modal,
      close
    );
  }

  /* =========================================================
     SIZE GUIDE
     ========================================================= */

  function initSizeGuide() {
    const modal =
      $("[data-size-guide-modal]");

    if (!modal) return;

    const openButtons =
      $$("[data-size-guide-open]");

    const closeButtons =
      $$("[data-size-guide-close]", modal);

    const tabs =
      $$("[data-size-tab]", modal);

    const panels =
      $$("[data-size-panel]", modal);

    function close() {
      closeModal(modal);
    }

    function activateTab(
      target
    ) {
      tabs.forEach((tab) => {
        const active =
          tab.dataset.sizeTab ===
          target;

        tab.classList.toggle(
          "is-active",
          active
        );

        tab.setAttribute(
          "aria-selected",
          active ? "true" : "false"
        );
      });

      panels.forEach((panel) => {
        const active =
          panel.dataset.sizePanel ===
          target;

        panel.classList.toggle(
          "is-active",
          active
        );

        panel.hidden = !active;
      });
    }

    openButtons.forEach(
      (button) => {
        on(button, "click", (event) => {
          event.preventDefault();
          openModal(modal);
        });
      }
    );

    closeButtons.forEach(
      (button) => {
        on(button, "click", close);
      }
    );

    tabs.forEach(
      (tab) => {
        on(tab, "click", () => {
          activateTab(
            tab.dataset.sizeTab
          );
        });
      }
    );

    bindModalBackdrop(
      modal,
      close
    );

    const initial =
      tabs.find(
        (tab) =>
          tab.classList.contains(
            "is-active"
          )
      )?.dataset.sizeTab ||
      tabs[0]?.dataset.sizeTab;

    if (initial) {
      activateTab(initial);
    }
  }

  /* =========================================================
     ORDER TRACKING
     ========================================================= */

  function initOrderTracking() {
    const modal =
      $("[data-track-order-modal]");

    if (!modal) return;

    const openButtons =
      $$("[data-open-track-order]");

    const closeButtons =
      $$("[data-track-order-close]", modal);

    const form =
      $("[data-track-order-form]", modal);

    const message =
      $("[data-track-order-message]", modal);

    const result =
      $("[data-track-order-result]", modal);

    const again =
      $("[data-track-again]", modal);

    function close() {
      closeModal(modal);
    }

    function reset() {
      if (result) {
        result.hidden = true;
      }

      if (form) {
        form.hidden = false;
      }

      if (message) {
        message.textContent = "";
      }
    }

    openButtons.forEach(
      (button) => {
        on(button, "click", (event) => {
          event.preventDefault();
          reset();
          openModal(modal);
        });
      }
    );

    closeButtons.forEach(
      (button) => {
        on(button, "click", close);
      }
    );

    on(again, "click", reset);

    on(
      form,
      "submit",
      async (event) => {
        event.preventDefault();

        if (!supabase) {
          if (message) {
            message.textContent =
              "Store connection unavailable. Please try again.";
          }

          return;
        }

        const orderNumber =
          $(
            "#track-order-number",
            form
          )?.value
            .trim()
            .toUpperCase();

        const phone =
          $(
            "#track-order-phone",
            form
          )?.value
            .trim()
            .replace(/\D/g, "");

        if (!orderNumber || !phone) {
          if (message) {
            message.textContent =
              "Please provide both Order Number and Phone Number.";
          }

          return;
        }

        const submit =
          $(".track-order-submit", form);

        if (submit) {
          submit.disabled = true;
          submit.textContent =
            "LOCATING SHIPMENT...";
        }

        if (message) {
          message.textContent = "";
        }

        try {
          const {
            data,
            error
          } = await supabase
            .from("orders")
            .select("*")
            .eq(
              "order_number",
              orderNumber
            )
            .maybeSingle();

          if (error || !data) {
            throw new Error(
              "No shipment found matching that Order Number."
            );
          }

          const dbPhone =
            String(
              data.customer_phone || ""
            ).replace(/\D/g, "");

          const inputLast10 =
            phone.slice(-10);

          const dbLast10 =
            dbPhone.slice(-10);

          if (
            !inputLast10 ||
            inputLast10 !== dbLast10
          ) {
            throw new Error(
              "Phone number does not match order records."
            );
          }

          if (form) {
            form.hidden = true;
          }

          if (result) {
            result.hidden = false;
          }

          const numberEl =
            $(
              "[data-track-result-number]",
              result
            );

          const statusEl =
            $(
              "[data-track-result-status]",
              result
            );

          const courierEl =
            $(
              "[data-track-result-courier]",
              result
            );

          const trackingEl =
            $(
              "[data-track-result-tracking]",
              result
            );

          if (numberEl) {
            numberEl.textContent =
              data.order_number ||
              orderNumber;
          }

          const status =
            String(
              data.order_status ||
                "PLACED"
            )
              .trim()
              .toUpperCase();

          if (statusEl) {
            statusEl.textContent =
              status;
          }

          if (courierEl) {
            courierEl.textContent =
              data.courier ||
              "In Dispatch Preparation";
          }

          if (trackingEl) {
            trackingEl.textContent =
              data.tracking_number ||
              "Will update upon courier pickup";
          }

          updateTrackingProgress(
            result,
            status
          );
        } catch (error) {
          if (message) {
            message.textContent =
              error?.message ||
              "Failed to find order.";
          }
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.textContent =
              "LOOKUP SHIPMENT";
          }
        }
      }
    );

    bindModalBackdrop(
      modal,
      close
    );
  }

  function updateTrackingProgress(
    result,
    status
  ) {
    if (!result) return;

    const steps = [
      "PLACED",
      "PACKED",
      "SHIPPED",
      "OUT FOR DELIVERY",
      "DELIVERED"
    ];

    /*
     * Handle common alternate status names
     * without changing the database value.
     */
    const normalized =
      {
        PROCESSING: "PLACED",
        CONFIRMED: "PLACED",
        DISPATCHED: "SHIPPED",
        OUT_FOR_DELIVERY:
          "OUT FOR DELIVERY"
      }[status] || status;

    let index =
      steps.indexOf(normalized);

    if (index < 0) {
      index = 0;
    }

    const percentage =
      Math.max(
        15,
        Math.min(
          100,
          ((index + 1) /
            steps.length) *
            100
        )
      );

    const line =
      $(
        "[data-track-progress-line]",
        result
      );

    if (line) {
      line.style.width =
        `${percentage}%`;
    }

    $$(".track-step", result)
      .forEach((step) => {
        const stepName =
          step.dataset.trackStep;

        const stepIndex =
          steps.indexOf(stepName);

        step.classList.toggle(
          "is-active",
          stepIndex >= 0 &&
            stepIndex <= index
        );

        step.classList.toggle(
          "is-current",
          stepIndex === index
        );
      });
  }

  /* =========================================================
     ACCOUNT MODAL OPEN/CLOSE
     ========================================================= */

  function initAccountModal() {
    const modal =
      $("[data-account-modal]");

    if (!modal) return;

    const openButtons =
      $$("[data-open-account]");

    const closeButtons =
      $$("[data-account-close]", modal);

    openButtons.forEach(
      (button) => {
        on(button, "click", (event) => {
          event.preventDefault();
          openModal(modal);
        });
      }
    );

    closeButtons.forEach(
      (button) => {
        on(button, "click", () => {
          closeModal(modal);
        });
      }
    );

    bindModalBackdrop(
      modal,
      () => closeModal(modal)
    );
  }

  /* =========================================================
     CART OPENERS
     ========================================================= */

  function initCartTriggers() {
    /*
     * cart.js remains the single owner of cart state.
     * main.js only forwards UI intent when a cart API exists.
     */

    $$(
      "[data-open-cart], [data-cart-open]"
    ).forEach((button) => {
      on(button, "click", (event) => {
        event.preventDefault();

        if (
          window.BULKKOT_CART &&
          typeof window.BULKKOT_CART.openCart ===
            "function"
        ) {
          window.BULKKOT_CART.openCart();
        }
      });
    });
  }

  /* =========================================================
     DYNAMIC UI TRIGGER DELEGATION
     ========================================================= */

  function initDelegatedUITriggers() {
    /*
     * Static controls already have local listeners. Delegation is
     * intentionally a fallback for controls rendered/replaced after
     * DOMContentLoaded. A locally-bound handler calls preventDefault(),
     * so this delegated layer will not execute the same action twice.
     */
    on(document, "click", (event) => {
      if (event.defaultPrevented) return;

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) return;

      /* Mobile drawer */
      const openDrawer = target.closest("[data-open-drawer]");
      if (openDrawer) {
        event.preventDefault();

        const drawer = $("[data-mobile-drawer]");
        const overlay = $("[data-mobile-overlay]");

        state.drawerOpen = true;
        drawer?.classList.add("is-open");
        drawer?.setAttribute("aria-hidden", "false");
        overlay?.classList.add("is-active");
        overlay?.setAttribute("aria-hidden", "false");

        lockBodyScroll();
        return;
      }

      const mobileOverlay = target.closest("[data-mobile-overlay]");
      if (mobileOverlay) {
        event.preventDefault();

        const drawer = $("[data-mobile-drawer]");

        if (state.drawerOpen) {
          state.drawerOpen = false;
          drawer?.classList.remove("is-open");
          drawer?.setAttribute("aria-hidden", "true");
          mobileOverlay.classList.remove("is-active");
          mobileOverlay.setAttribute("aria-hidden", "true");
          unlockBodyScroll();
        }

        return;
      }

      const drawerLink = target.closest("[data-mobile-drawer] a");
      if (drawerLink) {
        const drawer = $("[data-mobile-drawer]");
        const overlay = $("[data-mobile-overlay]");

        if (state.drawerOpen) {
          state.drawerOpen = false;
          drawer?.classList.remove("is-open");
          drawer?.setAttribute("aria-hidden", "true");
          overlay?.classList.remove("is-active");
          overlay?.setAttribute("aria-hidden", "true");
          unlockBodyScroll();
        }

        return;
      }

      const closeDrawerButton =
        target.closest("[data-close-drawer]");

      if (closeDrawerButton) {
        event.preventDefault();

        const drawer = $("[data-mobile-drawer]");
        const overlay = $("[data-mobile-overlay]");

        if (state.drawerOpen) {
          state.drawerOpen = false;
          drawer?.classList.remove("is-open");
          drawer?.setAttribute("aria-hidden", "true");
          overlay?.classList.remove("is-active");
          overlay?.setAttribute("aria-hidden", "true");
          unlockBodyScroll();
        }

        return;
      }

      /* Header search */
      if (target.closest("#headerSearchToggle")) {
        event.preventDefault();

        if (window.BULKKOT_UI?.openSearch) {
          window.BULKKOT_UI.openSearch();
        }

        return;
      }

      if (target.closest("#headerSearchClose")) {
        event.preventDefault();

        if (window.BULKKOT_UI?.closeSearch) {
          window.BULKKOT_UI.closeSearch(true);
        }

        return;
      }

      /* Account */
      if (target.closest("[data-open-account]")) {
        event.preventDefault();

        const modal = $("[data-account-modal]");
        openModal(modal);
        return;
      }

      if (target.closest("[data-account-close]")) {
        event.preventDefault();

        const modal =
          target.closest("[data-account-modal]") ||
          $("[data-account-modal]");

        closeModal(modal);
        return;
      }

      /* Track order */
      if (target.closest("[data-open-track-order]")) {
        event.preventDefault();

        const modal = $("[data-track-order-modal]");
        const form = $("[data-track-order-form]", modal);
        const result = $("[data-track-order-result]", modal);
        const message = $("[data-track-order-message]", modal);

        if (form) form.hidden = false;
        if (result) result.hidden = true;
        if (message) message.textContent = "";

        openModal(modal);
        return;
      }

      if (target.closest("[data-track-order-close]")) {
        event.preventDefault();

        const modal =
          target.closest("[data-track-order-modal]") ||
          $("[data-track-order-modal]");

        closeModal(modal);
        return;
      }

      /* Size guide */
      if (target.closest("[data-size-guide-open]")) {
        event.preventDefault();

        const modal = $("[data-size-guide-modal]");
        openModal(modal);
        return;
      }

      if (target.closest("[data-size-guide-close]")) {
        event.preventDefault();

        const modal =
          target.closest("[data-size-guide-modal]") ||
          $("[data-size-guide-modal]");

        closeModal(modal);
        return;
      }

      /* About */
      if (target.closest("[data-open-about]")) {
        event.preventDefault();

        const modal = $("[data-about-modal]");
        openModal(modal);
        return;
      }

      if (target.closest("[data-close-about]")) {
        event.preventDefault();

        const modal =
          target.closest("[data-about-modal]") ||
          $("[data-about-modal]");

        closeModal(modal);
        return;
      }

      /* Policies */
      const policyButton =
        target.closest("[data-open-policy]");

      if (policyButton) {
        event.preventDefault();

        const modal = $("[data-policy-modal]");

        const type =
          policyButton.dataset.openPolicy;

        const policy =
          POLICY_DATA[type] || {
            title: "INFORMATION",
            content:
              "<p>Information coming soon.</p>"
          };

        $("[data-policy-title]", modal).textContent =
          policy.title;

        $("[data-policy-content]", modal).innerHTML =
          policy.content;

        openModal(modal);
        return;
      }

      if (target.closest("[data-close-policy]")) {
        event.preventDefault();

        const modal =
          target.closest("[data-policy-modal]") ||
          $("[data-policy-modal]");

        closeModal(modal);
      }
    });
  }

  /* =========================================================
     GLOBAL CLICK BEHAVIOUR
     ========================================================= */

  function initGlobalClicks() {
    /*
     * Delegated PDP / cart / navigation actions.
     * Only actions explicitly exposed by other modules
     * are forwarded.
     */

    on(document, "click", (event) => {
      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) return;

      /*
       * Close modal when a generic backdrop
       * carries data-modal-close.
       */
      const modalClose =
        target.closest(
          "[data-modal-close]"
        );

      if (modalClose) {
        const modal =
          modalClose.closest(
            ".modal, [role='dialog'], [data-modal]"
          );

        if (modal) {
          closeModal(modal);
        }
      }
    });
  }

  /* =========================================================
     ESCAPE KEY
     ========================================================= */

  function initKeyboardControls() {
    on(document, "keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      /*
       * Close cart first because cart is an
       * independent module.
       */
      if (
        window.BULKKOT_CART &&
        typeof window.BULKKOT_CART.closeCart ===
          "function"
      ) {
        window.BULKKOT_CART.closeCart();
      }

      /* Close drawer. */
      if (window.BULKKOT_UI?.closeDrawer) {
        window.BULKKOT_UI.closeDrawer();
      }

      /* Close active generic modal. */
      if (state.activeModal) {
        closeModal(
          state.activeModal
        );
      }

      /* Close header search. */
      if (window.BULKKOT_UI?.closeSearch) {
        window.BULKKOT_UI.closeSearch(
          false
        );
      }

      /*
       * Welcome popup is not managed by
       * generic modal locking.
       */
      const welcome =
        $("#welcomePopupModal");

      if (welcome) {
        welcome.classList.remove(
          "is-open"
        );

        welcome.setAttribute(
          "aria-hidden",
          "true"
        );
      }

      /*
       * Final safety against stale body-lock
       * state after multiple overlays.
       */
      if (
        !$(".is-open[data-account-modal], .is-open[data-policy-modal], .is-open[data-about-modal], .is-open[data-size-guide-modal], .is-open[data-track-order-modal], [data-mobile-drawer].is-open")
      ) {
        forceUnlockBodyScroll();
      }
    });
  }

  /* =========================================================
     FOCUS MANAGEMENT
     ========================================================= */

  function initAccessibilityGuards() {
    /*
     * Prevent accidental interaction with hidden
     * mobile drawer content when closed.
     */
    const drawer =
      $("[data-mobile-drawer]");

    if (drawer) {
      const observer =
        new MutationObserver(() => {
          const open =
            drawer.classList.contains(
              "is-open"
            );

          drawer.setAttribute(
            "aria-hidden",
            open
              ? "false"
              : "true"
          );
        });

      observer.observe(drawer, {
        attributes: true,
        attributeFilter: [
          "class"
        ]
      });
    }

    /*
     * Make images resilient without touching
     * existing image styling.
     */
    $$("img").forEach((image) => {
      on(
        image,
        "error",
        () => {
          if (
            image.dataset.fallbackApplied ===
            "true"
          ) {
            return;
          }

          image.dataset.fallbackApplied =
            "true";

          image.src =
            FALLBACK_IMAGE;
        },
        { once: true }
      );
    });
  }

  /* =========================================================
     ORDER COMPLETION REFRESH
     ========================================================= */

  function initStoreEvents() {
    on(
      window,
      "bulkkot:order-completed",
      () => {
        /*
         * Let cart.js remain responsible for
         * cart clearing/rendering.
         */
        if (
          window.BULKKOT_CART &&
          typeof window.BULKKOT_CART.renderCart ===
            "function"
        ) {
          window.BULKKOT_CART.renderCart();
        }

        /*
         * Refresh account order history if
         * a logged-in account is open.
         */
        refreshCurrentUserOrders();
      }
    );
  }

  async function refreshCurrentUserOrders() {
    if (!supabase) return;

    try {
      const {
        data
      } = await supabase.auth.getUser();

      if (data?.user) {
        await loadCustomerOrders(
          data.user.id
        );
      }
    } catch {
      /* Non-critical refresh. */
    }
  }

  /* =========================================================
     PAGE VISIBILITY
     ========================================================= */

  function initVisibilityHandling() {
    on(
      document,
      "visibilitychange",
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          /*
           * Stop editorial timer while page
           * isn't visible.
           */
          if (
            state.editorialTimer
          ) {
            clearInterval(
              state.editorialTimer
            );

            state.editorialTimer = null;
          }
        } else {
          /*
           * Reinitializeing the carousel isn't
           * necessary; simply let its own
           * controller continue on next user
           * interaction.
           */
        }
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function initStorefront() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    initMobileDrawer();
    initHeaderSearch();
    initEditorialCarousel();
    initWelcomePopup();

    initPolicyModal();
    initAboutModal();
    initSizeGuide();
    initOrderTracking();
    initAccountModal();

    /*
     * Delegated fallback for controls that may be inserted or
     * replaced after the initial DOM scan.
     */
    initDelegatedUITriggers();

    initCartTriggers();
    initGlobalClicks();
    initKeyboardControls();
    initAccessibilityGuards();

    initStoreEvents();
    initVisibilityHandling();

    /*
     * Backend-dependent systems are intentionally
     * isolated so a failed Supabase request cannot
     * break the storefront UI.
     */
    void initAuth();
    void loadCMSContent();
    void syncStoreSettings();

    /*
     * Signal that the global storefront engine
     * is ready. Other page modules can listen
     * without depending on execution order.
     */
    window.dispatchEvent(
      new CustomEvent(
        "bulkkot:storefront-ready"
      )
    );
  }

  /* =========================================================
     PUBLIC API
     * ========================================================= */

  window.BULKKOT_MAIN = {
    version: "production-hardened",

    openModal,
    closeModal,

    refreshAuthUI:
      async function () {
        if (!supabase) return;

        try {
          const {
            data
          } =
            await supabase.auth.getUser();

          /*
           * Account UI can be refreshed by
           * triggering the same public auth
           * event path.
           */
          window.dispatchEvent(
            new CustomEvent(
              "bulkkot:auth-refresh",
              {
                detail: {
                  user:
                    data?.user || null
                }
              }
            )
          );
        } catch {
          /* Non-critical. */
        }
      },

    getSupabase: () =>
      supabase
  };

  /* =========================================================
     BOOT
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initStorefront,
      { once: true }
    );
  } else {
    initStorefront();
  }
})();
