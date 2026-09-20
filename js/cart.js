/**
 * BULKKOT — Cart / Checkout Engine
 * Production Hardened
 *
 * Responsibilities:
 * - Local cart persistence
 * - Cart rendering
 * - Quantity management
 * - Coupon validation
 * - Shipping calculation
 * - Checkout form
 * - Stock verification
 * - Order creation
 * - Customer autofill
 * - Cart drawer state
 *
 * Visual identity intentionally preserved.
 */

(function () {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const STORAGE_KEY = "bulkkot_cart";

  const SUPABASE_URL =
    "https://pgubjluqgqvrybvehzeh.supabase.co";

  const SUPABASE_ANON_KEY =
    "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const FALLBACK_IMAGE =
    "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";

  const SIZES = ["S", "M", "L", "XL"];

  /* =========================================================
     STATE
     ========================================================= */

  let cart = [];
  let appliedCoupon = null;

  let storeSettings = {
    shipping_fee: 0,
    free_shipping_threshold: 0,
    support_phone: ""
  };

  let currentStep = "bag";
  let selectedPayment = "online";
  let checkoutSubmitting = false;
  let initialized = false;

  /* =========================================================
     SUPABASE
     ========================================================= */

  function getSupabase() {
    if (window.bulkkotSupabase) {
      return window.bulkkotSupabase;
    }

    if (
      window.supabase &&
      typeof window.supabase.createClient ===
        "function"
    ) {
      window.bulkkotSupabase =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY
        );

      return window.bulkkotSupabase;
    }

    return null;
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function formatPrice(amount) {
    return (
      "₹" +
      Number(amount || 0).toLocaleString(
        "en-IN"
      )
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeQuantity(value) {
    const quantity =
      Number.parseInt(value, 10);

    if (!Number.isFinite(quantity)) {
      return 1;
    }

    return Math.max(
      1,
      Math.min(quantity, 99)
    );
  }

  function normalizePhone(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(-10);
  }

  function isValidPhone(value) {
    return /^\d{10}$/.test(
      normalizePhone(value)
    );
  }

  function isValidPincode(value) {
    return /^\d{6}$/.test(
      String(value || "").trim()
    );
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(value || "").trim()
    );
  }

  function getItemKey(item) {
    return (
      String(item?.id || "") +
      "::" +
      String(item?.size || "")
        .trim()
        .toUpperCase()
    );
  }

  function getStock(product, size) {
    if (!product) return 0;

    const stock = product.stock;

    if (
      stock &&
      typeof stock === "object" &&
      !Array.isArray(stock)
    ) {
      return Math.max(
        0,
        Number(stock[size] || 0)
      );
    }

    /*
     * Support alternative schemas if a product
     * exposes direct stock columns.
     */
    const direct =
      product[
        `stock_${String(size).toLowerCase()}`
      ];

    return Math.max(
      0,
      Number(direct || 0)
    );
  }

  function getProductImage(product) {
    if (
      Array.isArray(product?.images) &&
      product.images.length
    ) {
      return (
        product.images.find(Boolean) ||
        FALLBACK_IMAGE
      );
    }

    return (
      product?.image_url ||
      product?.image ||
      FALLBACK_IMAGE
    );
  }

  /* =========================================================
     CART STORAGE
     ========================================================= */

  function sanitizeCart(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    const clean = [];
    const seen = new Set();

    items.forEach((item) => {
      if (!item || item.id == null) {
        return;
      }

      const size =
        String(item.size || "M")
          .trim()
          .toUpperCase();

      const quantity =
        normalizeQuantity(
          item.quantity
        );

      const normalized = {
        id: item.id,
        name:
          String(
            item.name ||
              "BULKKOT PRODUCT"
          ),
        price: Math.max(
          0,
          Number(item.price || 0)
        ),
        size: SIZES.includes(size)
          ? size
          : "M",
        image:
          item.image ||
          FALLBACK_IMAGE,
        quantity
      };

      const key =
        getItemKey(normalized);

      if (seen.has(key)) {
        const existing =
          clean.find(
            (entry) =>
              getItemKey(entry) === key
          );

        if (existing) {
          existing.quantity =
            Math.min(
              99,
              existing.quantity +
                quantity
            );
        }

        return;
      }

      seen.add(key);
      clean.push(normalized);
    });

    return clean;
  }

  function loadCart() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        cart = [];
        updateCartBadge();
        return;
      }

      const parsed =
        JSON.parse(raw);

      cart =
        sanitizeCart(parsed);
    } catch (error) {
      console.warn(
        "BULKKOT cart recovery failed:",
        error
      );

      cart = [];
    }

    updateCartBadge();
  }

  function saveCart() {
    cart =
      sanitizeCart(cart);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cart)
      );
    } catch (error) {
      console.warn(
        "BULKKOT cart storage unavailable:",
        error
      );
    }

    updateCartBadge();
  }

  /* =========================================================
     CART BADGE
     ========================================================= */

  function updateCartBadge() {
    const totalCount =
      cart.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );

    document
      .querySelectorAll(
        "[data-cart-count], #cartCount"
      )
      .forEach((badge) => {
        badge.textContent =
          String(totalCount);

        badge.hidden =
          totalCount === 0;

        badge.setAttribute(
          "aria-label",
          `${totalCount} item${
            totalCount === 1
              ? ""
              : "s"
          } in cart`
        );
      });
  }

  /* =========================================================
     CART OPERATIONS
     ========================================================= */

  function addItem(item) {
    if (!item || item.id == null) {
      return false;
    }

    loadCart();

    const size =
      String(item.size || "M")
        .trim()
        .toUpperCase();

    const quantity =
      normalizeQuantity(
        item.quantity
      );

    const normalized = {
      id: item.id,
      name:
        String(
          item.name ||
            "BULKKOT PRODUCT"
        ),
      price: Math.max(
        0,
        Number(item.price || 0)
      ),
      size: SIZES.includes(size)
        ? size
        : "M",
      image:
        item.image ||
        FALLBACK_IMAGE,
      quantity
    };

    const key =
      getItemKey(normalized);

    const existingIndex =
      cart.findIndex(
        (entry) =>
          getItemKey(entry) ===
          key
      );

    if (existingIndex >= 0) {
      cart[existingIndex].quantity =
        Math.min(
          99,
          cart[existingIndex]
            .quantity +
            quantity
        );
    } else {
      cart.push(normalized);
    }

    saveCart();

    currentStep = "bag";

    openCart();

    return true;
  }

  function removeItem(index) {
    const safeIndex =
      Number(index);

    if (
      !Number.isInteger(
        safeIndex
      ) ||
      safeIndex < 0 ||
      safeIndex >= cart.length
    ) {
      return;
    }

    cart.splice(
      safeIndex,
      1
    );

    saveCart();

    if (
      cart.length === 0
    ) {
      appliedCoupon = null;
      currentStep = "bag";
    }

    renderCart();
  }

  function updateQuantity(
    index,
    quantity
  ) {
    const safeIndex =
      Number(index);

    if (
      !Number.isInteger(
        safeIndex
      ) ||
      !cart[safeIndex]
    ) {
      return;
    }

    const nextQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        nextQuantity
      ) ||
      nextQuantity <= 0
    ) {
      removeItem(safeIndex);
      return;
    }

    cart[safeIndex].quantity =
      Math.min(
        99,
        Math.max(
          1,
          Math.floor(
            nextQuantity
          )
        )
      );

    saveCart();
    renderCart();
  }

  function clearCart() {
    cart = [];
    appliedCoupon = null;
    currentStep = "bag";
    checkoutSubmitting = false;

    saveCart();
    renderCart();
  }

  /* =========================================================
     TOTALS
     ========================================================= */

  function getCartSubtotal() {
    return cart.reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(
            item.quantity || 0
          ),
      0
    );
  }

  function calculateDiscount(
    subtotal
  ) {
    if (!appliedCoupon) {
      return 0;
    }

    const minimum =
      Number(
        appliedCoupon.min_order_value ||
          appliedCoupon.minimum_order_value ||
          0
      );

    if (
      minimum > 0 &&
      subtotal < minimum
    ) {
      return 0;
    }

    const value =
      Number(
        appliedCoupon.discount_value ||
          appliedCoupon.value ||
          0
      );

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return 0;
    }

    const type =
      String(
        appliedCoupon.discount_type ||
          "flat"
      ).toLowerCase();

    if (
      type === "percentage" ||
      type === "percent"
    ) {
      const percentage =
        Math.min(
          100,
          Math.max(0, value)
        );

      return Math.min(
        subtotal,
        Math.round(
          subtotal *
            (percentage / 100)
        )
      );
    }

    return Math.min(
      subtotal,
      Math.max(0, value)
    );
  }

  function calculateShipping(
    amountAfterDiscount
  ) {
    const fee =
      Math.max(
        0,
        Number(
          storeSettings.shipping_fee ||
            0
        )
      );

    const threshold =
      Math.max(
        0,
        Number(
          storeSettings.free_shipping_threshold ||
            0
        )
      );

    if (fee <= 0) {
      return 0;
    }

    if (
      threshold > 0 &&
      amountAfterDiscount >=
        threshold
    ) {
      return 0;
    }

    return fee;
  }

  function getTotals() {
    const subtotal =
      getCartSubtotal();

    const discount =
      calculateDiscount(
        subtotal
      );

    const afterDiscount =
      Math.max(
        0,
        subtotal - discount
      );

    const shipping =
      calculateShipping(
        afterDiscount
      );

    return {
      subtotal,
      discount,
      shipping,
      total:
        afterDiscount +
        shipping
    };
  }

  /* =========================================================
     STORE SETTINGS
     ========================================================= */

  async function fetchSettings() {
    const client =
      getSupabase();

    if (!client) {
      return;
    }

    try {
      const {
        data,
        error
      } = await client
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.warn(
          "Store settings error:",
          error
        );
        return;
      }

      if (data) {
        storeSettings =
          Object.assign(
            {},
            storeSettings,
            data
          );
      }

      /*
       * Settings affect totals, so rerender
       * only if cart drawer is already visible.
       */
      const drawer =
        document.querySelector(
          "[data-cart-drawer]"
        );

      if (
        drawer?.classList.contains(
          "is-open"
        )
      ) {
        renderCart();
      }
    } catch (error) {
      console.warn(
        "BULKKOT settings load failed:",
        error
      );
    }
  }

  /* =========================================================
     STOCK VALIDATION
     ========================================================= */

  async function validateCartStock() {
    const client =
      getSupabase();

    if (!client) {
      throw new Error(
        "Store connection unavailable. Please try again."
      );
    }

    if (!cart.length) {
      throw new Error(
        "Your bag is empty."
      );
    }

    const ids = [
      ...new Set(
        cart.map(
          (item) => item.id
        )
      )
    ];

    const {
      data,
      error
    } = await client
      .from("products")
      .select(
        "id,name,price,stock,stock_s,stock_m,stock_l,stock_xl,image_url,images,active"
      )
      .in("id", ids);

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      throw new Error(
        "Unable to verify product availability."
      );
    }

    const products =
      new Map(
        data.map(
          (product) => [
            String(product.id),
            product
          ]
        )
      );

    const corrections = [];

    for (
      let index = 0;
      index < cart.length;
      index++
    ) {
      const item =
        cart[index];

      const product =
        products.get(
          String(item.id)
        );

      if (!product) {
        corrections.push({
          index,
          type: "removed",
          message:
            `${item.name} is no longer available.`
        });

        continue;
      }

      if (
        product.active === false
      ) {
        corrections.push({
          index,
          type: "removed",
          message:
            `${item.name} is currently unavailable.`
        });

        continue;
      }

      const available =
        getStock(
          product,
          item.size
        );

      if (available <= 0) {
        corrections.push({
          index,
          type: "removed",
          message:
            `${item.name} — size ${item.size} is sold out.`
        });

        continue;
      }

      if (
        item.quantity >
        available
      ) {
        corrections.push({
          index,
          type: "quantity",
          quantity:
            available,
          message:
            `${item.name} — only ${available} left in size ${item.size}.`
        });
      }

      /*
       * Refresh price/name/image from the database.
       * This prevents checkout from trusting stale
       * localStorage pricing.
       */
      item.name =
        product.name ||
        item.name;

      item.price =
        Number(
          product.price ??
            item.price ??
            0
        );

      item.image =
        getProductImage(
          product
        );
    }

    /*
     * Apply corrections after iteration so indices
     * remain stable.
     */
    const removedKeys = new Set(
      corrections
        .filter((item) => item.type === "removed")
        .map((item) => getItemKey(item))
    );

    if (removedKeys.size) {
      cart = cart.filter(
        (item) => !removedKeys.has(getItemKey(item))
      );
    }

    corrections
      .filter((item) => item.type === "quantity")
      .forEach((correction) => {
        const key = getItemKey(correction);
        const matching = cart.find(
          (item) => getItemKey(item) === key
        );

        if (
          matching &&
          Number.isFinite(Number(correction.quantity))
        ) {
          matching.quantity = Math.max(
            1,
            Math.min(99, Math.floor(Number(correction.quantity)))
          );
        }
      });

    saveCart();

    return {
      valid:
        corrections.length === 0,
      corrections,
      products
    };
  }

  /* =========================================================
     PINCODE
     ========================================================= */

  let pincodeRequestToken = 0;

  async function lookupPincode(
    pincode
  ) {
    const requestToken = ++pincodeRequestToken;
    const cleanPin =
      String(
        pincode || ""
      ).trim();

    if (
      !isValidPincode(
        cleanPin
      )
    ) {
      return;
    }

    const cityInput =
      document.getElementById(
        "chkCity"
      );

    const stateInput =
      document.getElementById(
        "chkState"
      );

    const statusBox =
      document.getElementById(
        "pincodeStatus"
      );

    if (statusBox) {
      statusBox.textContent =
        "Locating area...";

      statusBox.style.color =
        "#888";

      statusBox.style.display =
        "block";
    }

    try {
      const response =
        await fetch(
          `https://api.postalpincode.in/pincode/${encodeURIComponent(
            cleanPin
          )}`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          "Pincode lookup failed."
        );
      }

      const data =
        await response.json();

      const result =
        data?.[0];

      if (
        result?.Status ===
          "Success" &&
        Array.isArray(
          result.PostOffice
        ) &&
        result.PostOffice.length
      ) {
        const po =
          result.PostOffice[0];

        const district =
          po.District ||
          po.Block ||
          po.Circle ||
          "";

        const state =
          po.State || "";

        if (requestToken !== pincodeRequestToken) {
          return;
        }

        if (
          cityInput &&
          !cityInput.value
        ) {
          cityInput.value =
            district;
        }

        if (
          stateInput &&
          !stateInput.value
        ) {
          stateInput.value =
            state;
        }

        if (statusBox) {
          statusBox.textContent =
            `✓ Serviceable: ${district}, ${state}`;

          statusBox.style.color =
            "#31c48d";
        }

        return {
          district,
          state
        };
      }

      if (statusBox) {
        statusBox.textContent =
          "Please enter a valid 6-digit pincode.";

        statusBox.style.color =
          "#ff7777";
      }
    } catch (error) {
      console.warn(
        "Pincode lookup failed:",
        error
      );

      if (statusBox) {
        statusBox.textContent =
          "Unable to verify pincode right now.";

        statusBox.style.color =
          "#888";
      }
    }
  }

  /* =========================================================
     CART OPEN / CLOSE
     ========================================================= */

  function openCart() {
    const drawer =
      document.querySelector(
        "[data-cart-drawer]"
      );

    const overlay =
      document.querySelector(
        "[data-cart-overlay]"
      );

    if (!drawer) {
      return;
    }

    renderCart();

    drawer.classList.add(
      "is-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    overlay?.classList.add(
      "is-active"
    );

    overlay?.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    /*
     * Keep drawer visible if it was opened from
     * an off-screen position.
     */
    window.dispatchEvent(
      new CustomEvent(
        "bulkkot:cart-open"
      )
    );
  }

  function closeCart() {
    const drawer =
      document.querySelector(
        "[data-cart-drawer]"
      );

    const overlay =
      document.querySelector(
        "[data-cart-overlay]"
      );

    drawer?.classList.remove(
      "is-open"
    );

    drawer?.setAttribute(
      "aria-hidden",
      "true"
    );

    overlay?.classList.remove(
      "is-active"
    );

    overlay?.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * main.js may also own a modal/drawer lock.
     * Only remove the body class when no other
     * known overlay is active.
     */
    const otherOpenOverlay =
      document.querySelector(
        "[data-account-modal].is-open," +
          "[data-policy-modal].is-open," +
          "[data-about-modal].is-open," +
          "[data-size-guide-modal].is-open," +
          "[data-track-order-modal].is-open," +
          "[data-mobile-drawer].is-open"
      );

    if (!otherOpenOverlay) {
      document.body.classList.remove(
        "modal-open"
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        "bulkkot:cart-close"
      )
    );
  }

  /* =========================================================
     EMPTY CART
     ========================================================= */

  function renderEmptyCart(
    drawer
  ) {
    drawer.innerHTML = `
      <div class="cart-drawer__header">
        <div>
          <p
            class="eyebrow"
            style="
              color:var(--bk-red);
              font-size:10px;
              margin:0;
            "
          >
            BULKKOT · 불꽃
          </p>

          <h2>YOUR CART</h2>
        </div>

        <button
          type="button"
          class="drawer-close"
          data-close-cart
          aria-label="Close cart"
        >
          ×
        </button>
      </div>

      <div
        class="cart-body-wrapper"
        style="
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          text-align:center;
          padding:60px 24px;
        "
      >
        <span
          style="
            font-size:32px;
            color:#333;
            margin-bottom:12px;
          "
        >
          ◈
        </span>

        <h3
          style="
            font-size:16px;
            font-weight:800;
            color:#fff;
            margin:0 0 6px;
          "
        >
          YOUR BAG IS EMPTY
        </h3>

        <p
          style="
            font-size:12px;
            color:#888;
            line-height:1.6;
            margin:0 0 24px;
          "
        >
          Heavyweight silhouettes constructed
          with architectural restraint await.
        </p>

        <button
          type="button"
          class="bk-btn-primary"
          data-close-cart
          style="max-width:240px;"
        >
          START SHOPPING
        </button>
      </div>
    `;

    drawer
      .querySelectorAll(
        "[data-close-cart]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeCart
        );
      });
  }

  /* =========================================================
     BAG RENDER
     ========================================================= */

  function renderBag(
    drawer
  ) {
    const totals =
      getTotals();

    const itemsHTML =
      cart
        .map(
          (item, index) => `
            <div
              class="cart-item-row"
              data-cart-item="${index}"
            >
              <img
                src="${escapeHTML(
                  item.image ||
                    FALLBACK_IMAGE
                )}"
                alt="${escapeHTML(
                  item.name
                )}"
                class="cart-item-img"
                loading="lazy"
                onerror="
                  this.onerror=null;
                  this.src='${FALLBACK_IMAGE}';
                "
              >

              <div
                class="cart-item-meta"
              >
                <div>
                  <div
                    class="cart-item-title-row"
                  >
                    <h4>
                      ${escapeHTML(
                        item.name
                      )}
                    </h4>

                    <button
                      type="button"
                      class="cart-remove-btn"
                      data-cart-remove="${index}"
                      aria-label="Remove ${escapeHTML(
                        item.name
                      )}"
                    >
                      ×
                    </button>
                  </div>

                  <p
                    class="cart-size-label"
                  >
                    SIZE:
                    <strong
                      style="color:#fff;"
                    >
                      ${escapeHTML(
                        item.size
                      )}
                    </strong>
                  </p>
                </div>

                <div
                  class="cart-bottom-row"
                >
                  <div
                    class="cart-qty-pill"
                  >
                    <button
                      type="button"
                      data-cart-qty="${index}"
                      data-qty="${
                        Math.max(
                          0,
                          Number(
                            item.quantity
                          ) - 1
                        )
                      }"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <span>
                      ${Number(
                        item.quantity
                      )}
                    </span>

                    <button
                      type="button"
                      data-cart-qty="${index}"
                      data-qty="${
                        Number(
                          item.quantity
                        ) + 1
                      }"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div
                    class="cart-item-price"
                  >
                    ${formatPrice(
                      Number(
                        item.price
                      ) *
                        Number(
                          item.quantity
                        )
                    )}
                  </div>
                </div>
              </div>
            </div>
          `
        )
        .join("");

    drawer.innerHTML = `
      <div class="cart-drawer__header">
        <div>
          <p
            class="eyebrow"
            style="
              color:var(--bk-red);
              font-size:10px;
              margin:0;
            "
          >
            STEP 01 / 02
          </p>

          <h2>
            YOUR BAG (${cart.reduce(
              (sum, item) =>
                sum +
                Number(
                  item.quantity || 0
                ),
              0
            )})
          </h2>
        </div>

        <button
          type="button"
          class="drawer-close"
          data-close-cart
          aria-label="Close cart"
        >
          ×
        </button>
      </div>

      <div
        class="cart-body-wrapper"
      >
        <div
          class="cart-items-wrap"
        >
          ${itemsHTML}
        </div>

        <div
          style="
            margin:20px 0 10px;
            display:flex;
            gap:8px;
          "
        >
          <input
            type="text"
            id="cartCouponInput"
            class="bk-input"
            placeholder="DISCOUNT CODE"
            value="${
              appliedCoupon
                ? escapeHTML(
                    appliedCoupon.code
                  )
                : ""
            }"
            style="
              text-transform:uppercase;
              min-width:0;
            "
            ${
              appliedCoupon
                ? "disabled"
                : ""
            }
            autocomplete="off"
          >

          <button
            type="button"
            id="cartApplyCouponBtn"
            class="search-tag-btn"
            style="
              padding:0 16px;
              min-height:42px;
              font-weight:800;
              flex:0 0 auto;
            "
          >
            ${
              appliedCoupon
                ? "REMOVE"
                : "APPLY"
            }
          </button>
        </div>

        <div
          id="cartCouponMessage"
          style="
            min-height:16px;
            font-size:10px;
            font-weight:700;
            margin-top:2px;
          "
          aria-live="polite"
        ></div>
      </div>

      <div
        class="cart-drawer__footer"
      >
        <div
          class="cart-breakdown-row"
        >
          <span>SUBTOTAL</span>

          <span
            style="color:#fff;"
          >
            ${formatPrice(
              totals.subtotal
            )}
          </span>
        </div>

        ${
          totals.discount > 0
            ? `
              <div
                class="cart-breakdown-row"
                style="color:#31c48d;"
              >
                <span>
                  DISCOUNT
                  ${
                    appliedCoupon?.code
                      ? `(${escapeHTML(
                          appliedCoupon.code
                        )})`
                      : ""
                  }
                </span>

                <span>
                  -${formatPrice(
                    totals.discount
                  )}
                </span>
              </div>
            `
            : ""
        }

        <div
          class="cart-breakdown-row"
        >
          <span>DELIVERY</span>

          <span
            style="
              ${
                totals.shipping ===
                0
                  ? "color:#31c48d;font-weight:800;"
                  : "color:#fff;"
              }
            "
          >
            ${
              totals.shipping ===
              0
                ? "FREE"
                : formatPrice(
                    totals.shipping
                  )
            }
          </span>
        </div>

        <div
          class="cart-total-strip"
        >
          <span>
            ESTIMATED TOTAL
          </span>

          <strong>
            ${formatPrice(
              totals.total
            )}
          </strong>
        </div>

        <button
          type="button"
          id="proceedToCheckoutBtn"
          class="bk-btn-primary"
        >
          PROCEED TO CHECKOUT →
        </button>
      </div>
    `;

    bindBagEvents(
      drawer
    );
  }

  /* =========================================================
     BAG EVENTS
     ========================================================= */

  function bindBagEvents(
    drawer
  ) {
    drawer
      .querySelectorAll(
        "[data-close-cart]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeCart
        );
      });

    drawer
      .querySelectorAll(
        "[data-cart-remove]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            removeItem(
              Number(
                button.dataset
                  .cartRemove
              )
            );
          }
        );
      });

    drawer
      .querySelectorAll(
        "[data-cart-qty]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            updateQuantity(
              Number(
                button.dataset
                  .cartQty
              ),
              Number(
                button.dataset.qty
              )
            );
          }
        );
      });

    const checkoutButton =
      drawer.querySelector(
        "#proceedToCheckoutBtn"
      );

    checkoutButton?.addEventListener(
      "click",
      async () => {
        if (!cart.length) {
          return;
        }

        checkoutButton.disabled =
          true;

        checkoutButton.textContent =
          "VERIFYING AVAILABILITY...";

        try {
          const result =
            await validateCartStock();

          if (
            !result.valid
          ) {
            renderCart();

            showCartMessage(
              "Some quantities or products changed. Please review your bag.",
              "error"
            );

            return;
          }

          currentStep =
            "checkout";

          renderCart();
        } catch (error) {
          checkoutButton.disabled =
            false;

          checkoutButton.textContent =
            "PROCEED TO CHECKOUT →";

          showCartMessage(
            error?.message ||
              "Unable to verify stock.",
            "error"
          );
        }
      }
    );

    const couponButton =
      drawer.querySelector(
        "#cartApplyCouponBtn"
      );

    couponButton?.addEventListener(
      "click",
      handleCouponAction
    );

    const couponInput =
      drawer.querySelector(
        "#cartCouponInput"
      );

    couponInput?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Enter"
        ) {
          event.preventDefault();
          handleCouponAction();
        }
      }
    );
  }

  /* =========================================================
     CART MESSAGE
     ========================================================= */

  function showCartMessage(
    message,
    type = "error"
  ) {
    const box =
      document.querySelector(
        "#cartCouponMessage"
      );

    if (!box) {
      return;
    }

    box.textContent =
      String(message || "");

    box.style.color =
      type === "success"
        ? "#31c48d"
        : "#ff7777";
  }

  /* =========================================================
     COUPON
     ========================================================= */

  async function handleCouponAction() {
    if (appliedCoupon) {
      appliedCoupon = null;
      renderCart();
      return;
    }

    const drawer =
      document.querySelector(
        "[data-cart-drawer]"
      );

    const input =
      drawer?.querySelector(
        "#cartCouponInput"
      );

    const code =
      String(
        input?.value || ""
      )
        .trim()
        .toUpperCase();

    if (!code) {
      showCartMessage(
        "Enter a discount code."
      );
      return;
    }

    const client =
      getSupabase();

    if (!client) {
      showCartMessage(
        "Store connection unavailable."
      );
      return;
    }

    const button =
      drawer.querySelector(
        "#cartApplyCouponBtn"
      );

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "CHECKING...";
    }

    try {
      const subtotal =
        getCartSubtotal();

      /*
       * Prefer RPC when available because coupon
       * validation should ideally remain server-side.
       *
       * If the RPC is unavailable, fall back to
       * the existing coupons table query.
       */
      let coupon = null;

      try {
        const rpc =
          await client.rpc(
            "validate_coupon",
            {
              p_code: code,
              p_order_value:
                subtotal
            }
          );

        if (
          !rpc.error &&
          rpc.data
        ) {
          coupon =
            Array.isArray(
              rpc.data
            )
              ? rpc.data[0]
              : rpc.data;
        }
      } catch {
        /* Fallback below. */
      }

      if (!coupon) {
        const {
          data,
          error
        } = await client
          .from("coupons")
          .select("*")
          .eq(
            "code",
            code
          )
          .eq(
            "active",
            true
          )
          .maybeSingle();

        if (
          error ||
          !data
        ) {
          throw new Error(
            "Invalid or inactive coupon."
          );
        }

        coupon = data;
      }

      const minimum =
        Number(
          coupon.min_order_value ||
            coupon.minimum_order_value ||
            0
        );

      if (
        minimum > 0 &&
        subtotal < minimum
      ) {
        throw new Error(
          `Minimum order value is ${formatPrice(
            minimum
          )}.`
        );
      }

      appliedCoupon =
        coupon;

      renderCart();

      showCartMessage(
        "Coupon applied successfully.",
        "success"
      );
    } catch (error) {
      console.warn(
        "Coupon validation failed:",
        error
      );

      if (button) {
        button.disabled =
          false;

        button.textContent =
          "APPLY";
      }

      showCartMessage(
        error?.message ||
          "Invalid coupon."
      );
    }
  }

  /* =========================================================
     CHECKOUT RENDER
     ========================================================= */

  function renderCheckout(
    drawer
  ) {
    const totals =
      getTotals();

    drawer.innerHTML = `
      <div
        class="cart-drawer__header"
      >
        <div>
          <p
            class="eyebrow"
            style="
              color:var(--bk-red);
              font-size:10px;
              margin:0;
            "
          >
            STEP 02 / 02
          </p>

          <h2>
            DISPATCH & PAYMENT
          </h2>
        </div>

        <button
          type="button"
          class="drawer-close"
          data-close-cart
          aria-label="Close cart"
        >
          ×
        </button>
      </div>

      <div
        class="cart-body-wrapper"
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            margin-bottom:14px;
          "
        >
          <button
            type="button"
            id="backToBagBtn"
            style="
              background:none;
              border:none;
              color:#888;
              font-size:11px;
              font-weight:800;
              cursor:pointer;
              padding:8px 0;
            "
          >
            ← BACK TO BAG
          </button>

          <button
            type="button"
            id="cartAuthTrigger"
            style="
              background:none;
              border:none;
              color:var(--bk-red);
              font-size:10px;
              font-weight:800;
              cursor:pointer;
              padding:8px 0;
            "
          >
            SIGN IN FOR AUTOFILL
          </button>
        </div>

        <form
          id="storefrontCheckoutForm"
          novalidate
        >
          <div
            class="bk-input-group"
          >
            <span>
              CUSTOMER DETAILS
            </span>

            <div
              style="
                display:grid;
                grid-template-columns:
                  minmax(0,1fr)
                  minmax(0,1fr);
                gap:8px;
              "
            >
              <input
                type="text"
                id="chkName"
                class="bk-input"
                placeholder="Full Name *"
                autocomplete="name"
                required
              >

              <input
                type="tel"
                id="chkPhone"
                class="bk-input"
                placeholder="10-digit Phone *"
                maxlength="15"
                inputmode="tel"
                autocomplete="tel"
                required
              >
            </div>
          </div>

          <div
            class="bk-input-group"
          >
            <span>
              EMAIL FOR DISPATCH UPDATES
            </span>

            <input
              type="email"
              id="chkEmail"
              class="bk-input"
              placeholder="name@email.com *"
              autocomplete="email"
              required
            >
          </div>

          <div
            class="bk-input-group"
          >
            <span>
              DELIVERY ADDRESS
            </span>

            <input
              type="text"
              id="chkAddress"
              class="bk-input"
              placeholder="House No / Street / Landmark *"
              autocomplete="street-address"
              required
              style="margin-bottom:8px;"
            >

            <div
              style="
                display:grid;
                grid-template-columns:
                  minmax(0,1fr)
                  minmax(0,1fr)
                  minmax(0,1fr);
                gap:8px;
              "
            >
              <input
                type="text"
                id="chkPincode"
                class="bk-input"
                placeholder="Pincode *"
                maxlength="6"
                inputmode="numeric"
                autocomplete="postal-code"
                required
              >

              <input
                type="text"
                id="chkCity"
                class="bk-input"
                placeholder="City *"
                autocomplete="address-level2"
                required
              >

              <input
                type="text"
                id="chkState"
                class="bk-input"
                placeholder="State *"
                autocomplete="address-level1"
                required
              >
            </div>

            <small
              id="pincodeStatus"
              style="
                font-size:10px;
                font-weight:700;
                margin-top:4px;
                display:none;
              "
              aria-live="polite"
            ></small>
          </div>

          <div
            class="bk-input-group"
            style="margin-top:16px;"
          >
            <span>
              SELECT PAYMENT OPTION
            </span>

            <label
              class="payment-card-label"
              style="
                display:flex;
                align-items:flex-start;
                gap:12px;
                padding:14px;
                background:#111;
                border:1px solid ${
                  selectedPayment ===
                  "online"
                    ? "var(--bk-red)"
                    : "var(--bk-border)"
                };
                border-radius:6px;
                margin-bottom:8px;
                cursor:pointer;
                transition:
                  border-color .2s;
              "
            >
              <input
                type="radio"
                name="payment_mode"
                value="online"
                ${
                  selectedPayment ===
                  "online"
                    ? "checked"
                    : ""
                }
                style="
                  margin-top:2px;
                  accent-color:
                    var(--bk-red);
                "
              >

              <div
                style="flex:1;"
              >
                <div
                  style="
                    display:flex;
                    justify-content:
                      space-between;
                    align-items:center;
                    gap:8px;
                  "
                >
                  <strong
                    style="
                      font-size:12px;
                      color:#fff;
                    "
                  >
                    ONLINE UPI /
                    GPAY / PHONEPE
                  </strong>

                  <span
                    style="
                      font-size:8px;
                      background:
                        rgba(
                          49,
                          196,
                          141,
                          .15
                        );
                      color:#31c48d;
                      padding:2px 6px;
                      border-radius:4px;
                      font-weight:800;
                      white-space:nowrap;
                    "
                  >
                    FAST DISPATCH
                  </span>
                </div>

                <small
                  style="
                    font-size:10px;
                    color:#888;
                    display:block;
                    margin-top:4px;
                    line-height:1.4;
                  "
                >
                  Our team will contact you
                  on WhatsApp to collect
                  the payment securely.
                </small>
              </div>
            </label>

            <label
              class="payment-card-label"
              style="
                display:flex;
                align-items:flex-start;
                gap:12px;
                padding:14px;
                background:#111;
                border:1px solid ${
                  selectedPayment ===
                  "cod"
                    ? "var(--bk-red)"
                    : "var(--bk-border)"
                };
                border-radius:6px;
                cursor:pointer;
                transition:
                  border-color .2s;
              "
            >
              <input
                type="radio"
                name="payment_mode"
                value="cod"
                ${
                  selectedPayment ===
                  "cod"
                    ? "checked"
                    : ""
                }
                style="
                  margin-top:2px;
                  accent-color:
                    var(--bk-red);
                "
              >

              <div
                style="flex:1;"
              >
                <div
                  style="
                    display:flex;
                    justify-content:
                      space-between;
                    align-items:center;
                    gap:8px;
                  "
                >
                  <strong
                    style="
                      font-size:12px;
                      color:#fff;
                    "
                  >
                    CASH ON DELIVERY
                    (COD)
                  </strong>

                  <span
                    style="
                      font-size:8px;
                      border:1px solid #333;
                      color:#aaa;
                      padding:2px 6px;
                      border-radius:4px;
                      white-space:nowrap;
                    "
                  >
                    VERIFIED
                  </span>
                </div>

                <small
                  style="
                    font-size:10px;
                    color:#888;
                    display:block;
                    margin-top:4px;
                  "
                >
                  Pay when the courier
                  delivers your package.
                </small>
              </div>
            </label>
          </div>

          <div
            id="checkoutInlineError"
            style="
              color:#ff7777;
              font-size:11px;
              margin-top:10px;
              display:none;
            "
            role="alert"
            aria-live="polite"
          ></div>
        </form>
      </div>

      <div
        class="cart-drawer__footer"
      >
        <div
          class="cart-total-strip"
          style="
            border:none;
            padding:0;
            margin:0 0 12px;
          "
        >
          <span
            style="color:#888;"
          >
            TOTAL PAYABLE
          </span>

          <strong>
            ${formatPrice(
              totals.total
            )}
          </strong>
        </div>

        <button
          type="submit"
          form="storefrontCheckoutForm"
          id="cartSubmitOrderBtn"
          class="bk-btn-primary"
        >
          ${
            selectedPayment ===
            "online"
              ? "PLACE ORDER (UPI NOTIFICATION)"
              : "CONFIRM CASH ON DELIVERY"
          }
        </button>

        <div
          style="
            text-align:center;
            color:#555;
            font-size:10px;
            margin-top:10px;
          "
        >
          🔒 Secure order processing
        </div>
      </div>
    `;

    bindCheckoutEvents(
      drawer
    );

    void tryAutofillAddress();
  }

  /* =========================================================
     CHECKOUT EVENTS
     ========================================================= */

  function bindCheckoutEvents(
    drawer
  ) {
    drawer
      .querySelectorAll(
        "[data-close-cart]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeCart
        );
      });

    drawer
      .querySelector(
        "#backToBagBtn"
      )
      ?.addEventListener(
        "click",
        () => {
          currentStep = "bag";
          renderCart();
        }
      );

    drawer
      .querySelector(
        "#cartAuthTrigger"
      )
      ?.addEventListener(
        "click",
        () => {
          closeCart();

          const accountModal =
            document.querySelector(
              "[data-account-modal]"
            );

          if (!accountModal) {
            return;
          }

          /*
           * Prefer main.js API when available.
           */
          if (
            window.BULKKOT_MAIN &&
            typeof window.BULKKOT_MAIN
              .openModal ===
              "function"
          ) {
            window.BULKKOT_MAIN.openModal(
              accountModal
            );
            return;
          }

          accountModal.classList.add(
            "is-open"
          );

          accountModal.setAttribute(
            "aria-hidden",
            "false"
          );

          document.body.classList.add(
            "modal-open"
          );
        }
      );

    drawer
      .querySelectorAll(
        'input[name="payment_mode"]'
      )
      .forEach((radio) => {
        radio.addEventListener(
          "change",
          (event) => {
            selectedPayment =
              event.target.value ===
              "cod"
                ? "cod"
                : "online";

            drawer
              .querySelectorAll(
                ".payment-card-label"
              )
              .forEach(
                (label) => {
                  label.style.borderColor =
                    "var(--bk-border)";
                }
              );

            const selected =
              event.target.closest(
                ".payment-card-label"
              );

            if (selected) {
              selected.style.borderColor =
                "var(--bk-red)";
            }

            const button =
              drawer.querySelector(
                "#cartSubmitOrderBtn"
              );

            if (button) {
              button.textContent =
                selectedPayment ===
                "online"
                  ? "PLACE ORDER (UPI NOTIFICATION)"
                  : "CONFIRM CASH ON DELIVERY";
            }
          }
        );
      });

    const pinInput =
      drawer.querySelector(
        "#chkPincode"
      );

    let pinTimer = null;

    pinInput?.addEventListener(
      "input",
      (event) => {
        const value =
          String(
            event.target.value ||
              ""
          )
            .replace(/\D/g, "")
            .slice(0, 6);

        event.target.value =
          value;

        if (pinTimer) {
          clearTimeout(
            pinTimer
          );
        }

        if (
          value.length === 6
        ) {
          pinTimer =
            setTimeout(
              () =>
                lookupPincode(
                  value
                ),
              250
            );
        }
      }
    );

    const phoneInput =
      drawer.querySelector(
        "#chkPhone"
      );

    phoneInput?.addEventListener(
      "input",
      (event) => {
        event.target.value =
          String(
            event.target.value ||
              ""
          )
            .replace(/\D/g, "")
            .slice(0, 15);
      }
    );

    drawer
      .querySelector(
        "#storefrontCheckoutForm"
      )
      ?.addEventListener(
        "submit",
        handleCheckoutSubmit
      );
  }

  /* =========================================================
     CHECKOUT VALIDATION
     ========================================================= */

  function getCheckoutFields() {
    return {
      name:
        document
          .getElementById(
            "chkName"
          )
          ?.value.trim() || "",

      phone:
        document
          .getElementById(
            "chkPhone"
          )
          ?.value.trim() || "",

      email:
        document
          .getElementById(
            "chkEmail"
          )
          ?.value.trim() || "",

      address:
        document
          .getElementById(
            "chkAddress"
          )
          ?.value.trim() || "",

      city:
        document
          .getElementById(
            "chkCity"
          )
          ?.value.trim() || "",

      state:
        document
          .getElementById(
            "chkState"
          )
          ?.value.trim() || "",

      pincode:
        document
          .getElementById(
            "chkPincode"
          )
          ?.value.trim() || ""
    };
  }

  function validateCheckoutFields(
    fields
  ) {
    if (
      !fields.name ||
      fields.name.length < 2
    ) {
      return "Please enter your full name.";
    }

    if (
      !isValidPhone(
        fields.phone
      )
    ) {
      return "Please enter a valid 10-digit phone number.";
    }

    if (
      !isValidEmail(
        fields.email
      )
    ) {
      return "Please enter a valid email address.";
    }

    if (
      !fields.address ||
      fields.address.length < 5
    ) {
      return "Please enter your complete delivery address.";
    }

    if (!fields.city) {
      return "Please enter your city.";
    }

    if (!fields.state) {
      return "Please enter your state.";
    }

    if (
      !isValidPincode(
        fields.pincode
      )
    ) {
      return "Please enter a valid 6-digit pincode.";
    }

    return null;
  }

  /* =========================================================
     ORDER RPC
     ========================================================= */

  async function createOrder(
    client,
    fields
  ) {
    const rpcItems =
      cart.map((item) => ({
        id: item.id,
        size: item.size,
        quantity:
          Number(
            item.quantity
          )
      }));

    const customerPayload = {
      customer_name:
        fields.name,

      customer_email:
        fields.email,

      customer_phone:
        normalizePhone(
          fields.phone
        ),

      shipping_address:
        fields.address,

      shipping_city:
        fields.city,

      shipping_state:
        fields.state,

      shipping_pincode:
        fields.pincode,

      payment_method:
        selectedPayment
    };

    /*
     * Get current authenticated user.
     * The RPC can use it where supported.
     */
    let userId = null;

    try {
      const {
        data
      } =
        await client.auth.getUser();

      userId =
        data?.user?.id ||
        null;
    } catch {
      userId = null;
    }

    /*
     * Current BULKKOT installations have used
     * different create_order signatures over time.
     *
     * First try the current structured signature.
     */
    const attempts = [
      {
        p_items:
          rpcItems,

        p_customer:
          customerPayload,

        p_user_id:
          userId
      },

      {
        p_items:
          rpcItems,

        p_customer:
          customerPayload
      }
    ];

    let lastError = null;

    for (
      const payload of attempts
    ) {
      try {
        const {
          data,
          error
        } =
          await client.rpc(
            "create_order",
            payload
          );

        if (!error) {
          return data;
        }

        lastError =
          error;
      } catch (error) {
        lastError =
          error;
      }
    }

    throw (
      lastError ||
      new Error(
        "Unable to create order."
      )
    );
  }

  /* =========================================================
     CHECKOUT SUBMIT
     ========================================================= */

  async function handleCheckoutSubmit(
    event
  ) {
    event.preventDefault();

    if (
      checkoutSubmitting
    ) {
      return;
    }

    const errorBox =
      document.getElementById(
        "checkoutInlineError"
      );

    const submitButton =
      document.getElementById(
        "cartSubmitOrderBtn"
      );

    const fields =
      getCheckoutFields();

    function showError(
      message
    ) {
      if (!errorBox) {
        return;
      }

      errorBox.textContent =
        String(message || "");

      errorBox.style.display =
        "block";
    }

    function clearError() {
      if (!errorBox) {
        return;
      }

      errorBox.textContent =
        "";

      errorBox.style.display =
        "none";
    }

    clearError();

    const validationError =
      validateCheckoutFields(
        fields
      );

    if (validationError) {
      showError(
        validationError
      );
      return;
    }

    if (!cart.length) {
      showError(
        "Your bag is empty."
      );
      currentStep = "bag";
      renderCart();
      return;
    }

    checkoutSubmitting =
      true;

    if (submitButton) {
      submitButton.disabled =
        true;

      submitButton.textContent =
        "VERIFYING ORDER...";
    }

    try {
      const client =
        getSupabase();

      if (!client) {
        throw new Error(
          "Database connection unavailable."
        );
      }

      /*
       * Always verify stock immediately before
       * creating the order.
       */
      const stockResult =
        await validateCartStock();

      if (
        !stockResult.valid
      ) {
        throw new Error(
          "Some products or quantities changed. Please review your bag."
        );
      }

      /*
       * Recalculate totals after stock/product
       * refresh so stale localStorage price data
       * cannot be used for display.
       */
      const totals =
        getTotals();

      if (
        appliedCoupon
      ) {
        const discount =
          calculateDiscount(
            totals.subtotal
          );

        if (
          discount <= 0
        ) {
          appliedCoupon =
            null;
        }
      }

      if (submitButton) {
        submitButton.textContent =
          "CONFIRMING ORDER...";
      }

      const order =
        await createOrder(
          client,
          fields
        );

      if (!order) {
        throw new Error(
          "Order was not confirmed by the store."
        );
      }

      /*
       * Support both object and array RPC returns.
       */
      const orderData =
        Array.isArray(
          order
        )
          ? order[0]
          : order;

      const orderNumber =
        orderData?.order_number ||
        orderData?.order_id ||
        orderData?.id;

      if (!orderNumber) {
        throw new Error(
          "Order created but no order number was returned."
        );
      }

      const paymentMode =
        String(
          orderData?.payment_method ||
            selectedPayment
        ).toLowerCase();

      renderOrderSuccess(
        orderNumber,
        fields,
        paymentMode,
        totals.total
      );

      /*
       * Clear only after confirmed successful
       * order response.
       */
      cart = [];
      appliedCoupon = null;
      currentStep = "bag";

      saveCart();

      window.dispatchEvent(
        new CustomEvent(
          "bulkkot:order-completed",
          {
            detail: {
              orderNumber:
                String(
                  orderNumber
                ),
              paymentMethod:
                paymentMode,
              total:
                totals.total
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "BULKKOT checkout error:",
        error
      );

      showError(
        normalizeOrderError(
          error
        )
      );

      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          selectedPayment ===
          "online"
            ? "PLACE ORDER (UPI NOTIFICATION)"
            : "CONFIRM CASH ON DELIVERY";
      }
    } finally {
      checkoutSubmitting =
        false;
    }
  }

  function normalizeOrderError(
    error
  ) {
    const message =
      String(
        error?.message ||
          error?.details ||
          error ||
          ""
      );

    if (
      /stock|inventory|sold.?out|quantity/i.test(
        message
      )
    ) {
      return "One or more items are no longer available in the requested quantity. Please review your bag.";
    }

    if (
      /coupon/i.test(
        message
      )
    ) {
      return "The discount code could not be applied to this order.";
    }

    if (
      /duplicate|already exists/i.test(
        message
      )
    ) {
      return "This order appears to have already been submitted. Please check Track Order before trying again.";
    }

    if (
      /row-level security|permission denied|not authorized/i.test(
        message
      )
    ) {
      return "The store could not authorize this order. Please try again or contact BULKKOT support.";
    }

    return (
      message ||
      "Unable to place your order right now. Please try again."
    );
  }

  /* =========================================================
     ORDER SUCCESS
     ========================================================= */

  function renderOrderSuccess(
    orderNumber,
    fields,
    paymentMode,
    total
  ) {
    const drawer =
      document.querySelector(
        "[data-cart-drawer]"
      );

    if (!drawer) {
      return;
    }

    drawer.innerHTML = `
      <div
        class="cart-drawer__header"
      >
        <div>
          <p
            class="eyebrow"
            style="
              color:#31c48d;
              font-size:10px;
              margin:0;
            "
          >
            SUCCESSFULLY LOGGED
          </p>

          <h2>
            ORDER CONFIRMED
          </h2>
        </div>

        <button
          type="button"
          class="drawer-close"
          data-close-cart
          aria-label="Close cart"
        >
          ×
        </button>
      </div>

      <div
        class="cart-body-wrapper"
        style="
          text-align:center;
          padding:40px 24px;
        "
      >
        <div
          style="
            width:52px;
            height:52px;
            background:
              rgba(49,196,141,.12);
            color:#31c48d;
            border-radius:50%;
            display:grid;
            place-items:center;
            margin:0 auto 16px;
            font-size:24px;
          "
        >
          ✓
        </div>

        <p
          class="eyebrow"
          style="
            color:#31c48d;
            font-weight:900;
            margin-bottom:6px;
          "
        >
          DISPATCH QUEUE CONFIRMED
        </p>

        <h2
          style="
            font-size:22px;
            margin:0 0 8px;
            color:#fff;
            letter-spacing:.05em;
            word-break:break-word;
          "
        >
          ${escapeHTML(
            orderNumber
          )}
        </h2>

        <p
          style="
            color:#aaa;
            font-size:13px;
            line-height:1.6;
            margin:0 0 20px;
          "
        >
          Thank you,
          <strong>
            ${escapeHTML(
              fields.name
            )}
          </strong>.<br>

          Order Total:
          <strong>
            ${formatPrice(
              total
            )}
          </strong>
          (${escapeHTML(
            paymentMode.toUpperCase()
          )}).
        </p>

        ${
          paymentMode ===
          "online"
            ? `
              <div
                style="
                  background:#161616;
                  border:1px solid #333;
                  border-radius:8px;
                  padding:18px;
                  text-align:center;
                  margin-bottom:20px;
                "
              >
                <p
                  class="eyebrow"
                  style="
                    color:var(--bk-red);
                    font-size:10px;
                    margin:0 0 6px;
                  "
                >
                  NEXT STEP
                </p>

                <strong
                  style="
                    color:#fff;
                    font-size:13px;
                    display:block;
                    margin-bottom:8px;
                  "
                >
                  PAYMENT CONFIRMATION
                </strong>

                <p
                  style="
                    font-size:11px;
                    color:#888;
                    margin:0;
                    line-height:1.5;
                  "
                >
                  Our official support team
                  will contact you with
                  the payment instructions.
                </p>
              </div>
            `
            : `
              <div
                style="
                  background:#111;
                  border:1px solid var(--bk-border);
                  border-radius:6px;
                  padding:14px;
                  text-align:left;
                  font-size:11px;
                  line-height:1.7;
                  color:#888;
                  margin-bottom:24px;
                "
              >
                <strong
                  style="
                    color:#fff;
                    display:block;
                    margin-bottom:4px;
                  "
                >
                  ORDER STATUS
                </strong>

                Your order has been
                placed successfully and
                is now in the fulfilment queue.
              </div>
            `
        }

        <button
          type="button"
          class="bk-btn-primary"
          data-close-cart
          style="width:100%;"
        >
          CONTINUE EXPLORING
        </button>
      </div>
    `;

    drawer
      .querySelectorAll(
        "[data-close-cart]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeCart
        );
      });
  }

  /* =========================================================
     AUTOFILL
     ========================================================= */

  async function tryAutofillAddress() {
    const client =
      getSupabase();

    if (!client) {
      return;
    }

    try {
      const {
        data:
          authData
      } =
        await client.auth.getUser();

      const user =
        authData?.user;

      if (!user) {
        return;
      }

      const emailField =
        document.getElementById(
          "chkEmail"
        );

      if (
        emailField &&
        !emailField.value
      ) {
        emailField.value =
          user.email || "";
      }

      const {
        data: profile,
        error
      } = await client
        .from(
          "customer_profiles"
        )
        .select("*")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

      if (
        error ||
        !profile
      ) {
        return;
      }

      const mappings = {
        chkName:
          profile.full_name ||
          "",

        chkPhone:
          profile.phone ||
          "",

        chkAddress:
          profile.shipping_address ||
          "",

        chkCity:
          profile.shipping_city ||
          "",

        chkState:
          profile.shipping_state ||
          "",

        chkPincode:
          profile.shipping_pincode ||
          ""
      };

      Object.entries(
        mappings
      ).forEach(
        ([id, value]) => {
          const field =
            document.getElementById(
              id
            );

          if (
            field &&
            !field.value
          ) {
            field.value =
              value;
          }
        }
      );

      const pincode =
        document.getElementById(
          "chkPincode"
        )?.value;

      if (
        isValidPincode(
          pincode
        )
      ) {
        void lookupPincode(
          pincode
        );
      }
    } catch (error) {
      console.warn(
        "BULKKOT checkout autofill failed:",
        error
      );
    }
  }

  /* =========================================================
     MAIN RENDER
     ========================================================= */

  function renderCart() {
    const drawer =
      document.querySelector(
        "[data-cart-drawer]"
      );

    if (!drawer) {
      updateCartBadge();
      return;
    }

    loadCart();

    if (!cart.length) {
      currentStep = "bag";
      appliedCoupon = null;

      renderEmptyCart(
        drawer
      );

      return;
    }

    if (
      currentStep ===
      "checkout"
    ) {
      renderCheckout(
        drawer
      );
    } else {
      renderBag(
        drawer
      );
    }

    updateCartBadge();
  }

  /* =========================================================
     GLOBAL TRIGGERS
     ========================================================= */

  function bindGlobalTriggers() {
    /*
     * Event delegation prevents duplicate listeners
     * when main.js/cart.js are loaded together.
     */
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target instanceof
          Element
            ? event.target
            : null;

        if (!target) {
          return;
        }

        const openButton =
          target.closest(
            "[data-open-cart], [data-cart-open]"
          );

        if (openButton) {
          event.preventDefault();
          openCart();
          return;
        }

        const closeButton =
          target.closest(
            "[data-close-cart]"
          );

        if (closeButton) {
          event.preventDefault();
          closeCart();
        }
      }
    );

    const overlay =
      document.querySelector(
        "[data-cart-overlay]"
      );

    overlay?.addEventListener(
      "click",
      closeCart
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          closeCart();
        }
      }
    );
  }

  /* =========================================================
     RESPONSIVE SAFETY
     ========================================================= */

  function initResponsiveSafety() {
    /*
     * Prevent stale checkout state from surviving
     * an accidental page lifecycle transition.
     */
    window.addEventListener(
      "pageshow",
      () => {
        loadCart();
        updateCartBadge();
      }
    );

    /*
     * Re-render only when drawer is open.
     * This avoids needless DOM work on resize.
     */
    let resizeTimer = null;

    window.addEventListener(
      "resize",
      () => {
        if (resizeTimer) {
          clearTimeout(
            resizeTimer
          );
        }

        resizeTimer =
          setTimeout(() => {
            const drawer =
              document.querySelector(
                "[data-cart-drawer]"
              );

            if (
              drawer?.classList.contains(
                "is-open"
              )
            ) {
              renderCart();
            }
          }, 150);
      },
      {
        passive: true
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    if (initialized) {
      return;
    }

    initialized = true;

    loadCart();

    bindGlobalTriggers();
    initResponsiveSafety();

    void fetchSettings();

    /*
     * Public ready event.
     */
    window.dispatchEvent(
      new CustomEvent(
        "bulkkot:cart-ready"
      )
    );
  }

  /* =========================================================
     PUBLIC API
     * ========================================================= */

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    clearCart,

    openCart,
    closeCart,
    renderCart,

    getCart: () =>
      cart.map(
        (item) => ({
          ...item
        })
      ),

    getSubtotal:
      getCartSubtotal,

    getTotals,

    refresh: () => {
      loadCart();
      renderCart();
    }
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
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
