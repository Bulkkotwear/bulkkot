/**
 * BULKKOT — Production Cart & Checkout
 * Version 3.0
 *
 * Supports:
 * - Local cart
 * - COD
 * - UPI / QR payment via WhatsApp / Call
 * - Server-side coupon validation through create_order RPC
 * - Authoritative price + inventory verification through RPC
 */

(function () {
  "use strict";

  /* ============================================================
     CONFIG
  ============================================================ */

  const SUPABASE_URL =
    "https://pgubjluqgqvrybvehzeh.supabase.co";

  const SUPABASE_ANON_KEY =
    "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  /*
   * IMPORTANT:
   * Replace this with BULKKOT's real WhatsApp number
   * when you are ready to accept UPI payment confirmations.
   *
   * Format: country code + number, no + or spaces.
   * Example: 919876543210
   */
  const WHATSAPP_NUMBER = "91XXXXXXXXXX";

  const STORAGE_KEY = "bulkkot_cart";

  const supabase = window.supabase
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      )
    : null;

  let cart = [];

  let checkoutState = {
    couponCode: "",
    discount: 0,
    subtotal: 0,
    total: 0
  };


  /* ============================================================
     HELPERS
  ============================================================ */

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
      Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
      })
    );
  }


  function getQuantity(item) {
    return Math.max(
      1,
      Number(item?.quantity || 1)
    );
  }


  function getSubtotal() {
    return cart.reduce(
      (total, item) =>
        total +
        Number(item.price || 0) *
          getQuantity(item),
      0
    );
  }


  function normalizeCartItem(item) {
    return {
      id: String(item.id),
      name: String(item.name || ""),
      price: Number(item.price || 0),
      size: String(item.size || "M").toUpperCase(),
      image: String(item.image || ""),
      quantity: Math.max(
        1,
        Number(item.quantity || 1)
      )
    };
  }


  /* ============================================================
     CART STORAGE
  ============================================================ */

  function loadCart() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      cart = Array.isArray(saved)
        ? saved.map(normalizeCartItem)
        : [];
    } catch (error) {
      console.warn(
        "BULKKOT cart recovery failed:",
        error
      );

      cart = [];
    }

    saveCart(false);
    updateUI();
  }


  function saveCart(update = true) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(cart)
    );

    if (update) {
      updateUI();
    }
  }


  function clearCart() {
    cart = [];

    saveCart();

    resetCheckoutState();
  }


  function resetCheckoutState() {
    checkoutState = {
      couponCode: "",
      discount: 0,
      subtotal: 0,
      total: 0
    };
  }


  /* ============================================================
     CART UI
  ============================================================ */

  function updateUI() {
    const totalQty = cart.reduce(
      (sum, item) =>
        sum + getQuantity(item),
      0
    );

    document
      .querySelectorAll("[data-cart-count]")
      .forEach((el) => {
        el.textContent = totalQty;
        el.hidden = totalQty === 0;
      });

    renderCartDrawer();
  }


  function renderCartDrawer() {
    const container =
      document.getElementById(
        "cart-content"
      );

    if (!container) return;


    if (!cart.length) {
      container.innerHTML = `
        <div
          style="
            padding:40px 20px;
            text-align:center;
            color:#888;
          "
        >
          <p style="margin-bottom:16px;">
            YOUR BAG IS EMPTY
          </p>

          <button
            type="button"
            class="button button--outline"
            data-close-cart
            style="font-size:11px;"
          >
            CONTINUE SHOPPING
          </button>
        </div>
      `;

      bindDynamicCartEvents();

      return;
    }


    const subtotal = getSubtotal();


    const itemsHTML = cart
      .map((item, index) => {
        const quantity =
          getQuantity(item);

        return `
          <article
            class="cart-item"
            data-cart-index="${index}"
          >

            <img
              class="cart-item__image"
              src="${escapeHTML(
                item.image ||
                  "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png"
              )}"
              alt="${escapeHTML(item.name)}"
              loading="lazy"
            >

            <div class="cart-item__content">

              <div class="cart-item__top">

                <strong class="cart-item__name">
                  ${escapeHTML(item.name)}
                </strong>

                <span class="cart-item__price">
                  ${formatPrice(
                    item.price * quantity
                  )}
                </span>

              </div>

              <p class="cart-item__meta">
                SIZE: ${escapeHTML(item.size)}
              </p>

              <div class="cart-item__controls">

                <button
                  type="button"
                  class="cart-qty-btn"
                  data-cart-minus="${index}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <span class="cart-item__quantity">
                  ${quantity}
                </span>

                <button
                  type="button"
                  class="cart-qty-btn"
                  data-cart-plus="${index}"
                  aria-label="Increase quantity"
                >
                  +
                </button>

                <button
                  type="button"
                  class="cart-remove-btn"
                  data-cart-remove="${index}"
                >
                  REMOVE
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");


    container.innerHTML = `

      <div
        class="cart-items"
        style="
          padding:10px 20px;
          overflow-y:auto;
          max-height:calc(100vh - 250px);
        "
      >
        ${itemsHTML}
      </div>

      <div
        style="
          padding:20px;
          border-top:1px solid #222;
          background:#070707;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            font-weight:800;
            font-size:14px;
            margin-bottom:14px;
          "
        >
          <span>SUBTOTAL</span>

          <strong>
            ${formatPrice(subtotal)}
          </strong>
        </div>

        <button
          type="button"
          id="cart-checkout-trigger"
          class="button button--primary cart-checkout-btn"
        >
          CHECKOUT · ${formatPrice(subtotal)}
        </button>

      </div>
    `;


    bindDynamicCartEvents();
  }


  function bindDynamicCartEvents() {
    const container =
      document.getElementById(
        "cart-content"
      );

    if (!container) return;


    container
      .querySelectorAll(
        "[data-cart-minus]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            changeQty(
              Number(
                button.dataset.cartMinus
              ),
              -1
            )
        );
      });


    container
      .querySelectorAll(
        "[data-cart-plus]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            changeQty(
              Number(
                button.dataset.cartPlus
              ),
              1
            )
        );
      });


    container
      .querySelectorAll(
        "[data-cart-remove]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            removeItem(
              Number(
                button.dataset.cartRemove
              )
            )
        );
      });


    document
      .getElementById(
        "cart-checkout-trigger"
      )
      ?.addEventListener(
        "click",
        openCheckoutModal
      );


    container
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


  /* ============================================================
     CART ACTIONS
  ============================================================ */

  function addItem(item) {
    if (
      !item ||
      !item.id ||
      !item.size
    ) {
      return;
    }


    const normalized =
      normalizeCartItem(item);


    const existing =
      cart.find(
        (cartItem) =>
          String(cartItem.id) ===
            String(normalized.id) &&
          String(cartItem.size) ===
            String(normalized.size)
      );


    if (existing) {
      existing.quantity +=
        normalized.quantity;
    } else {
      cart.push(normalized);
    }


    saveCart();

    openCart();
  }


  function removeItem(index) {
    if (!cart[index]) return;

    cart.splice(index, 1);

    saveCart();
  }


  function changeQty(index, delta) {
    const item = cart[index];

    if (!item) return;


    item.quantity =
      getQuantity(item) +
      Number(delta || 0);


    if (item.quantity <= 0) {
      cart.splice(index, 1);
    }


    saveCart();
  }


  /* ============================================================
     CHECKOUT MODAL
  ============================================================ */

  function createCheckoutModal() {
    let modal =
      document.getElementById(
        "checkout-modal"
      );

    if (modal) return modal;


    modal =
      document.createElement("div");

    modal.id =
      "checkout-modal";

    modal.className =
      "content-modal";

    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    modal.innerHTML = `

      <div class="content-modal__panel checkout-panel">

        <button
          type="button"
          class="drawer-close"
          id="close-checkout-btn"
          aria-label="Close checkout"
        >
          ×
        </button>


        <p class="eyebrow">
          BULKKOT · CHECKOUT
        </p>

        <h2>
          COMPLETE YOUR ORDER
        </h2>


        <form
          id="checkout-order-form"
          class="checkout-form"
          novalidate
        >

          <!-- CUSTOMER -->

          <div class="checkout-field">
            <label for="order-name">
              FULL NAME
            </label>

            <input
              type="text"
              id="order-name"
              autocomplete="name"
              required
            >
          </div>


          <div class="checkout-grid">

            <div class="checkout-field">

              <label for="order-email">
                EMAIL ADDRESS
              </label>

              <input
                type="email"
                id="order-email"
                autocomplete="email"
                required
              >

            </div>


            <div class="checkout-field">

              <label for="order-phone">
                PHONE NUMBER
              </label>

              <input
                type="tel"
                id="order-phone"
                maxlength="10"
                inputmode="numeric"
                autocomplete="tel"
                required
              >

            </div>

          </div>


          <!-- ADDRESS -->

          <div class="checkout-field">

            <label for="order-address">
              DELIVERY ADDRESS
            </label>

            <textarea
              id="order-address"
              rows="3"
              autocomplete="street-address"
              required
            ></textarea>

          </div>


          <div class="checkout-grid">

            <div class="checkout-field">

              <label for="order-city">
                CITY
              </label>

              <input
                type="text"
                id="order-city"
                autocomplete="address-level2"
                required
              >

            </div>


            <div class="checkout-field">

              <label for="order-state">
                STATE
              </label>

              <input
                type="text"
                id="order-state"
                autocomplete="address-level1"
                required
              >

            </div>

          </div>


          <div class="checkout-field">

            <label for="order-pincode">
              PINCODE
            </label>

            <input
              type="text"
              id="order-pincode"
              maxlength="6"
              inputmode="numeric"
              autocomplete="postal-code"
              required
            >

          </div>


          <!-- COUPON -->

          <div class="checkout-coupon">

            <p class="checkout-section-label">
              DISCOUNT CODE
            </p>

            <div
              style="
                display:flex;
                gap:8px;
                align-items:stretch;
              "
            >

              <input
                type="text"
                id="checkout-coupon-code"
                placeholder="ENTER COUPON"
                autocomplete="off"
                maxlength="50"
                style="
                  flex:1;
                  text-transform:uppercase;
                "
              >

              <button
                type="button"
                id="apply-coupon-btn"
                class="button button--outline"
              >
                APPLY
              </button>

            </div>

            <div
              id="coupon-message"
              class="checkout-coupon-message"
              role="status"
              aria-live="polite"
              style="margin-top:8px;"
            ></div>

          </div>


          <!-- PAYMENT -->

          <div class="checkout-payment">

            <p class="checkout-section-label">
              PAYMENT METHOD
            </p>


            <label class="checkout-payment-option">

              <input
                type="radio"
                name="payment_method"
                value="cod"
                checked
              >

              <span>
                CASH ON DELIVERY
              </span>

            </label>


            <label class="checkout-payment-option">

              <input
                type="radio"
                name="payment_method"
                value="upi"
              >

              <span>
                UPI / QR · WHATSAPP / CALL
              </span>

            </label>


            <div
              id="upi-payment-note"
              style="
                display:none;
                margin-top:10px;
                padding:12px;
                border:1px solid #222;
                font-size:12px;
                line-height:1.6;
                color:#aaa;
              "
            >
              After placing your order, BULKKOT will
              confirm the UPI / QR payment with you
              through WhatsApp or phone before packing.
            </div>

          </div>


          <!-- ORDER SUMMARY -->

          <div
            class="checkout-summary"
            style="
              margin-top:20px;
              padding-top:18px;
              border-top:1px solid #222;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                margin-bottom:8px;
              "
            >
              <span>
                SUBTOTAL
              </span>

              <strong id="checkout-subtotal">
                ₹0
              </strong>
            </div>


            <div
              id="checkout-discount-row"
              style="
                display:none;
                justify-content:space-between;
                margin-bottom:8px;
              "
            >

              <span>
                DISCOUNT
              </span>

              <strong
                id="checkout-discount"
              >
                -₹0
              </strong>

            </div>


            <div
              style="
                display:flex;
                justify-content:space-between;
                padding-top:10px;
                border-top:1px solid #222;
                font-size:15px;
                font-weight:800;
              "
            >

              <span>
                TOTAL
              </span>

              <strong id="checkout-total">
                ₹0
              </strong>

            </div>

          </div>


          <div
            id="checkout-err-msg"
            class="checkout-error"
            role="alert"
            aria-live="polite"
          ></div>


          <button
            type="submit"
            id="order-submit-btn"
            class="button button--primary checkout-submit"
          >
            PLACE ORDER
          </button>

        </form>

      </div>
    `;


    document.body.appendChild(modal);


    modal
      .querySelector(
        "#close-checkout-btn"
      )
      ?.addEventListener(
        "click",
        closeCheckoutModal
      );


    modal.addEventListener(
      "click",
      (event) => {
        if (event.target === modal) {
          closeCheckoutModal();
        }
      }
    );


    modal
      .querySelector(
        "#checkout-order-form"
      )
      ?.addEventListener(
        "submit",
        handleOrderSubmit
      );


    modal
      .querySelector(
        "#apply-coupon-btn"
      )
      ?.addEventListener(
        "click",
        handleCouponApply
      );


    modal
      .querySelector(
        "#checkout-coupon-code"
      )
      ?.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleCouponApply();
          }
        }
      );


    modal
      .querySelectorAll(
        'input[name="payment_method"]'
      )
      .forEach((input) => {
        input.addEventListener(
          "change",
          updatePaymentUI
        );
      });


    return modal;
  }


  function openCheckoutModal() {
    if (!cart.length) return;


    closeCart();


    const modal =
      createCheckoutModal();


    resetCheckoutState();


    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );


    document.body.classList.add(
      "modal-open"
    );


    updateCheckoutSummary();

    updatePaymentUI();


    setTimeout(() => {
      document
        .getElementById(
          "order-name"
        )
        ?.focus();
    }, 50);
  }


  function closeCheckoutModal() {
    const modal =
      document.getElementById(
        "checkout-modal"
      );

    if (!modal) return;


    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    if (
      !document.querySelector(
        ".cart-drawer.is-open"
      )
    ) {
      document.body.classList.remove(
        "modal-open"
      );
    }
  }


  /* ============================================================
     CHECKOUT DATA
  ============================================================ */

  function getCheckoutData() {
    return {
      customer_name:
        document
          .getElementById(
            "order-name"
          )
          ?.value.trim() || "",

      customer_email:
        document
          .getElementById(
            "order-email"
          )
          ?.value
          .trim()
          .toLowerCase() || "",

      customer_phone:
        document
          .getElementById(
            "order-phone"
          )
          ?.value.replace(
            /\D/g,
            ""
          ) || "",

      shipping_address:
        document
          .getElementById(
            "order-address"
          )
          ?.value.trim() || "",

      shipping_city:
        document
          .getElementById(
            "order-city"
          )
          ?.value.trim() || "",

      shipping_state:
        document
          .getElementById(
            "order-state"
          )
          ?.value.trim() || "",

      shipping_pincode:
        document
          .getElementById(
            "order-pincode"
          )
          ?.value.replace(
            /\D/g,
            ""
          ) || "",

      payment_method:
        document.querySelector(
          'input[name="payment_method"]:checked'
        )?.value || "cod"
    };
  }


  function validateCheckout(data) {
    if (!data.customer_name) {
      return "Please enter your full name.";
    }


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        data.customer_email
      )
    ) {
      return "Please enter a valid email address.";
    }


    if (
      !/^\d{10}$/.test(
        data.customer_phone
      )
    ) {
      return "Please enter a valid 10-digit phone number.";
    }


    if (
      data.shipping_address.length < 8
    ) {
      return "Please enter your complete delivery address.";
    }


    if (!data.shipping_city) {
      return "Please enter your city.";
    }


    if (!data.shipping_state) {
      return "Please enter your state.";
    }


    if (
      !/^\d{6}$/.test(
        data.shipping_pincode
      )
    ) {
      return "Please enter a valid 6-digit pincode.";
    }


    if (!cart.length) {
      return "Your cart is empty.";
    }


    return null;
  }


  /* ============================================================
     PAYMENT UI
  ============================================================ */

  function updatePaymentUI() {
    const selected =
      document.querySelector(
        'input[name="payment_method"]:checked'
      )?.value;


    const note =
      document.getElementById(
        "upi-payment-note"
      );


    if (!note) return;


    note.style.display =
      selected === "upi"
        ? "block"
        : "none";
  }


  /* ============================================================
     COUPON UI
  ============================================================ */

  function setCouponMessage(
    message,
    type = ""
  ) {
    const element =
      document.getElementById(
        "coupon-message"
      );

    if (!element) return;


    element.textContent =
      message || "";


    element.dataset.state =
      type;
  }


  function updateCheckoutSummary() {
    const subtotal =
      getSubtotal();


    const discount =
      Number(
        checkoutState.discount || 0
      );


    const total =
      Math.max(
        0,
        subtotal - discount
      );


    checkoutState.subtotal =
      subtotal;

    checkoutState.total =
      total;


    const subtotalElement =
      document.getElementById(
        "checkout-subtotal"
      );

    const discountRow =
      document.getElementById(
        "checkout-discount-row"
      );

    const discountElement =
      document.getElementById(
        "checkout-discount"
      );

    const totalElement =
      document.getElementById(
        "checkout-total"
      );


    if (subtotalElement) {
      subtotalElement.textContent =
        formatPrice(subtotal);
    }


    if (discountRow) {
      discountRow.style.display =
        discount > 0
          ? "flex"
          : "none";
    }


    if (discountElement) {
      discountElement.textContent =
        "-" +
        formatPrice(discount);
    }


    if (totalElement) {
      totalElement.textContent =
        formatPrice(total);
    }
  }


  /*
   * Coupon validation happens through create_order RPC.
   *
   * We deliberately DO NOT create a separate public
   * coupon-validation RPC.
   *
   * That keeps coupon rules authoritative on the server.
   *
   * For the preview, we calculate an expected display value
   * only after loading the coupon definition through a safe
   * server-side RPC would be available.
   *
   * Since the current migration intentionally exposes no public
   * coupon reader, APPLY performs a lightweight server validation
   * using a zero-risk preview RPC is NOT possible.
   *
   * Therefore we use the actual create_order transaction only
   * at final submission.
   *
   * To give the customer immediate APPLY behaviour, we validate
   * basic code presence here and show:
   * "Coupon will be verified at checkout."
   *
   * The actual authoritative discount is returned by create_order.
   */

  async function handleCouponApply() {
    const input =
      document.getElementById(
        "checkout-coupon-code"
      );

    const button =
      document.getElementById(
        "apply-coupon-btn"
      );


    if (!input || !button) {
      return;
    }


    const code =
      input.value
        .trim()
        .toUpperCase();


    if (!code) {
      checkoutState.couponCode = "";
      checkoutState.discount = 0;

      setCouponMessage(
        "Enter a coupon code.",
        "error"
      );

      updateCheckoutSummary();

      return;
    }


    if (!supabase) {
      setCouponMessage(
        "Store connection unavailable.",
        "error"
      );

      return;
    }


    /*
     * We cannot safely claim a discount from the client
     * without a dedicated server-side validation RPC.
     *
     * The actual create_order RPC remains authoritative.
     *
     * So we store the code and verify it during order creation.
     */

    checkoutState.couponCode =
      code;


    checkoutState.discount =
      0;


    setCouponMessage(
      `${code} added. Final discount will be verified securely when you place the order.`,
      "pending"
    );


    button.textContent =
      "APPLIED";

    button.disabled = true;


    updateCheckoutSummary();
  }


  function clearCoupon() {
    checkoutState.couponCode = "";
    checkoutState.discount = 0;


    const input =
      document.getElementById(
        "checkout-coupon-code"
      );

    const button =
      document.getElementById(
        "apply-coupon-btn"
      );


    if (input) {
      input.value = "";
    }


    if (button) {
      button.textContent =
        "APPLY";

      button.disabled =
        false;
    }


    setCouponMessage(
      "",
      ""
    );


    updateCheckoutSummary();
  }


  /* ============================================================
     ORDER SUBMISSION
  ============================================================ */

  async function handleOrderSubmit(
    event
  ) {
    event.preventDefault();


    const button =
      document.getElementById(
        "order-submit-btn"
      );

    const errorElement =
      document.getElementById(
        "checkout-err-msg"
      );


    if (
      !button ||
      !errorElement
    ) {
      return;
    }


    errorElement.textContent =
      "";


    const checkoutData =
      getCheckoutData();


    const validationError =
      validateCheckout(
        checkoutData
      );


    if (validationError) {
      errorElement.textContent =
        validationError;

      return;
    }


    if (!supabase) {
      errorElement.textContent =
        "Store connection unavailable.";

      return;
    }


    button.disabled =
      true;

    button.textContent =
      "PLACING ORDER...";


    try {

      /*
       * IMPORTANT:
       * Client price is NOT sent.
       *
       * RPC fetches authoritative product prices
       * from the products table.
       */

      const cartPayload =
        cart.map((item) => ({
          id: item.id,
          product_id: item.id,
          size: item.size,
          quantity:
            getQuantity(item)
        }));


      const {
        data,
        error
      } =
        await supabase.rpc(
          "create_order",
          {
            p_customer_name:
              checkoutData.customer_name,

            p_customer_email:
              checkoutData.customer_email,

            p_customer_phone:
              checkoutData.customer_phone,

            p_shipping_address:
              checkoutData.shipping_address,

            p_shipping_city:
              checkoutData.shipping_city,

            p_shipping_state:
              checkoutData.shipping_state,

            p_shipping_pincode:
              checkoutData.shipping_pincode,

            p_payment_method:
              checkoutData.payment_method,

            p_items:
              cartPayload,

            p_coupon_code:
              checkoutState.couponCode ||
              null
          }
        );


      if (error) {
        throw error;
      }


      /*
       * New RPC returns:
       *
       * {
       *   success,
       *   order_number,
       *   subtotal,
       *   discount,
       *   total,
       *   coupon_code,
       *   ...
       * }
       */

      const result =
        Array.isArray(data)
          ? data[0]
          : data;


      const orderNumber =
        result?.order_number ||
        "";


      const finalSubtotal =
        Number(
          result?.subtotal ??
          getSubtotal()
        );


      const finalDiscount =
        Number(
          result?.discount || 0
        );


      const finalTotal =
        Number(
          result?.total ??
          Math.max(
            0,
            finalSubtotal -
              finalDiscount
          )
        );


      const finalCoupon =
        result?.coupon_code ||
        checkoutState.couponCode ||
        "";


      clearCart();


      showOrderSuccess({
        orderNumber,
        subtotal:
          finalSubtotal,
        discount:
          finalDiscount,
        total:
          finalTotal,
        couponCode:
          finalCoupon,
        paymentMethod:
          checkoutData.payment_method
      });


    } catch (error) {

      console.error(
        "BULKKOT order error:",
        error
      );


      const raw =
        String(
          error?.message ||
          error ||
          ""
        ).toLowerCase();


      let message =
        "We could not place your order. Please try again.";


      if (
        raw.includes(
          "invalid coupon"
        )
      ) {
        message =
          "This coupon code is invalid.";
        clearCoupon();

      } else if (
        raw.includes(
          "inactive"
        ) &&
        raw.includes(
          "coupon"
        )
      ) {
        message =
          "This coupon is currently inactive.";
        clearCoupon();

      } else if (
        raw.includes(
          "expired"
        )
      ) {
        message =
          "This coupon has expired.";
        clearCoupon();

      } else if (
        raw.includes(
          "minimum order"
        )
      ) {
        message =
          "This coupon requires a higher order value.";
        clearCoupon();

      } else if (
        raw.includes(
          "insufficient stock"
        ) ||
        raw.includes(
          "stock"
        )
      ) {
        message =
          "One or more selected items are no longer available in the requested quantity.";

      } else if (
        raw.includes(
          "product not found"
        ) ||
        raw.includes(
          "no longer available"
        )
      ) {
        message =
          "One of the selected products is no longer available.";

      } else if (
        raw.includes(
          "payment method"
        ) ||
        raw.includes(
          "allowed methods"
        )
      ) {
        message =
          "Please select a valid payment method.";
      }


      errorElement.textContent =
        message;


      button.disabled =
        false;

      button.textContent =
        "PLACE ORDER";
    }
  }


  /* ============================================================
     SUCCESS
  ============================================================ */

  function showOrderSuccess({
    orderNumber,
    subtotal,
    discount,
    total,
    couponCode,
    paymentMethod
  }) {

    const modal =
      document.getElementById(
        "checkout-modal"
      );


    if (!modal) return;


    const panel =
      modal.querySelector(
        ".content-modal__panel"
      );


    if (!panel) return;


    const paymentMessage =
      paymentMethod === "upi"
        ? `
          <div
            style="
              margin:20px 0;
              padding:16px;
              border:1px solid #222;
              background:#080808;
              text-align:left;
              line-height:1.7;
              font-size:13px;
            "
          >

            <strong
              style="
                display:block;
                margin-bottom:6px;
              "
            >
              UPI / QR PAYMENT
            </strong>

            Your order has been placed.
            Please contact BULKKOT via WhatsApp
            or phone to complete the UPI / QR payment.

          </div>
        `
        : `
          <div
            style="
              margin:20px 0;
              padding:16px;
              border:1px solid #222;
              background:#080808;
              text-align:left;
              line-height:1.7;
              font-size:13px;
            "
          >

            <strong
              style="
                display:block;
                margin-bottom:6px;
              "
            >
              CASH ON DELIVERY
            </strong>

            Your order has been placed successfully.
            We will prepare it after order confirmation.

          </div>
        `;


    panel.innerHTML = `

      <button
        type="button"
        class="drawer-close"
        id="close-success-btn"
        aria-label="Close"
      >
        ×
      </button>


      <div class="order-success">

        <p class="eyebrow">
          BULKKOT · ORDER PLACED
        </p>


        <h2>
          THANK YOU.
        </h2>


        ${
          orderNumber
            ? `
              <p
                class="order-success__number"
              >
                ORDER #${escapeHTML(
                  orderNumber
                )}
              </p>
            `
            : ""
        }


        <div
          style="
            margin:22px 0;
            padding:16px;
            border-top:1px solid #222;
            border-bottom:1px solid #222;
            text-align:left;
          "
        >

          <div
            style="
              display:flex;
              justify-content:space-between;
              margin-bottom:8px;
            "
          >
            <span>
              SUBTOTAL
            </span>

            <strong>
              ${formatPrice(
                subtotal
              )}
            </strong>
          </div>


          ${
            discount > 0
              ? `
                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    margin-bottom:8px;
                  "
                >
                  <span>
                    DISCOUNT
                    ${
                      couponCode
                        ? `(${escapeHTML(
                            couponCode
                          )})`
                        : ""
                    }
                  </span>

                  <strong>
                    -${formatPrice(
                      discount
                    )}
                  </strong>
                </div>
              `
              : ""
          }


          <div
            style="
              display:flex;
              justify-content:space-between;
              padding-top:10px;
              border-top:1px solid #222;
              font-weight:800;
            "
          >

            <span>
              TOTAL
            </span>

            <strong>
              ${formatPrice(
                total
              )}
            </strong>

          </div>

        </div>


        <p>
          Your order has been successfully placed.
          Your order number is
          <strong>
            ${escapeHTML(
              orderNumber
            )}
          </strong>.
        </p>


        ${paymentMessage}


        <button
          type="button"
          class="button button--primary"
          id="success-back-btn"
        >
          BACK TO SHOP
        </button>

      </div>
    `;


    document
      .getElementById(
        "close-success-btn"
      )
      ?.addEventListener(
        "click",
        closeCheckoutModal
      );


    document
      .getElementById(
        "success-back-btn"
      )
      ?.addEventListener(
        "click",
        () => {
          closeCheckoutModal();

          window.location.hash =
            "shop";
        }
      );


    modal
      .querySelector(
        ".content-modal__panel"
      )
      ?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
  }


  /* ============================================================
     CART DRAWER
  ============================================================ */

  function openCart() {
    const drawer =
      document.getElementById(
        "cart-drawer"
      );

    const overlay =
      document.querySelector(
        "[data-cart-overlay]"
      );


    drawer?.classList.add(
      "is-open"
    );

    drawer?.setAttribute(
      "aria-hidden",
      "false"
    );

    overlay?.classList.add(
      "is-open"
    );


    document.body.classList.add(
      "modal-open"
    );
  }


  function closeCart() {
    const drawer =
      document.getElementById(
        "cart-drawer"
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
      "is-open"
    );


    if (
      !document.querySelector(
        ".content-modal.is-open"
      )
    ) {
      document.body.classList.remove(
        "modal-open"
      );
    }
  }


  /* ============================================================
     PUBLIC API
  ============================================================ */

  window.BULKKOT_CART = {

    addItem,

    removeItem,

    changeQty,

    openCart,

    closeCart,

    clearCart,

    getItems: () =>
      [...cart],

    getSubtotal: () =>
      getSubtotal(),

    getCheckoutState: () =>
      ({ ...checkoutState })
  };


  /* ============================================================
     INIT
  ============================================================ */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      loadCart();


      document
        .querySelectorAll(
          "[data-open-cart]"
        )
        .forEach((el) => {
          el.addEventListener(
            "click",
            openCart
          );
        });


      document
        .querySelectorAll(
          "[data-close-cart]"
        )
        .forEach((el) => {
          el.addEventListener(
            "click",
            closeCart
          );
        });


      document
        .querySelector(
          "[data-cart-overlay]"
        )
        ?.addEventListener(
          "click",
          closeCart
        );


      document.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key !==
            "Escape"
          ) {
            return;
          }


          const checkout =
            document.getElementById(
              "checkout-modal"
            );


          if (
            checkout?.classList.contains(
              "is-open"
            )
          ) {
            closeCheckoutModal();
            return;
          }


          closeCart();
        }
      );

    }
  );

})();
