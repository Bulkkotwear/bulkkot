/* =========================================================
   BULKKOT — CART MANAGEMENT
   js/cart.js
   ========================================================= */

(() => {
  "use strict";

  const CART_KEY = "bulkkot_cart";

  /* -------------------------------------------------------
     CART STORAGE
  ------------------------------------------------------- */

  function getCart() {
    try {
      const storedCart = localStorage.getItem(CART_KEY);
      const cart = storedCart ? JSON.parse(storedCart) : [];

      return Array.isArray(cart) ? cart : [];
    } catch (error) {
      console.error("BULKKOT Cart: Failed to read cart.", error);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      updateCartBadge();
      renderCartDrawer();
    } catch (error) {
      console.error("BULKKOT Cart: Failed to save cart.", error);
    }
  }

  /* -------------------------------------------------------
     ADD TO CART
  ------------------------------------------------------- */

  function addToCart(product, size) {
    if (!product || !product.id) {
      console.error("BULKKOT Cart: Invalid product.");
      return;
    }

    if (!size) {
      console.warn("BULKKOT Cart: Product size is required.");
      return;
    }

    const cart = getCart();

    const existingItem = cart.find(
      item => String(item.id) === String(product.id) && item.size === size
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name || "BULKKOT Product",
        price: Number(product.price) || 0,
        image: product.image || "",
        size,
        quantity: 1
      });
    }

    saveCart(cart);

    // Optional UI feedback
    document.dispatchEvent(
      new CustomEvent("bulkkot:cart-updated", {
        detail: { cart }
      })
    );
  }

  /* -------------------------------------------------------
     UPDATE QUANTITY
  ------------------------------------------------------- */

  function updateQuantity(id, size, delta) {
    const cart = getCart();

    const item = cart.find(
      product =>
        String(product.id) === String(id) &&
        product.size === size
    );

    if (!item) return;

    item.quantity += Number(delta) || 0;

    if (item.quantity <= 0) {
      removeFromCart(id, size);
      return;
    }

    saveCart(cart);
  }

  /* -------------------------------------------------------
     REMOVE ITEM
  ------------------------------------------------------- */

  function removeFromCart(id, size) {
    const cart = getCart();

    const updatedCart = cart.filter(
      item =>
        !(
          String(item.id) === String(id) &&
          item.size === size
        )
    );

    saveCart(updatedCart);
  }

  /* -------------------------------------------------------
     SUBTOTAL
  ------------------------------------------------------- */

  function calculateSubtotal() {
    return getCart().reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;

      return total + price * quantity;
    }, 0);
  }

  /* -------------------------------------------------------
     FORMAT PRICE
  ------------------------------------------------------- */

  function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(price);
  }

  /* -------------------------------------------------------
     CART COUNT
  ------------------------------------------------------- */

  function updateCartBadge() {
    const cart = getCart();

    const count = cart.reduce(
      (total, item) => total + (Number(item.quantity) || 0),
      0
    );

    document.querySelectorAll(
      ".cart-count, [data-cart-count]"
    ).forEach(element => {
      element.textContent = count;

      element.hidden = count === 0;
      element.setAttribute("aria-label", `${count} items in cart`);
    });
  }

  /* -------------------------------------------------------
     RENDER CART DRAWER
  ------------------------------------------------------- */

  function renderCartDrawer() {
    const drawerBodies = document.querySelectorAll(
      ".drawer__body, #cart-content"
    );

    if (!drawerBodies.length) return;

    const cart = getCart();
    const subtotal = calculateSubtotal();

    drawerBodies.forEach(container => {
      if (!cart.length) {
        container.innerHTML = `
          <div class="cart-empty">
            <p class="cart-empty__korean">장바구니가 비어 있습니다</p>
            <h3>Your cart is empty.</h3>
            <p>
              Discover the latest BULKKOT essentials
              and build your collection.
            </p>

            <button
              type="button"
              class="btn btn--primary"
              data-close-cart
            >
              CONTINUE SHOPPING
            </button>
          </div>
        `;

        return;
      }

      container.innerHTML = `
        <div class="cart-items">
          ${cart.map(item => `
            <article class="cart-item">

              <div class="cart-item__image">
                ${
                  item.image
                    ? `<img
                        src="${escapeHTML(item.image)}"
                        alt="${escapeHTML(item.name)}"
                        loading="lazy"
                      >`
                    : `<div class="cart-item__image-placeholder"></div>`
                }
              </div>

              <div class="cart-item__info">

                <div class="cart-item__top">
                  <div>
                    <h3>${escapeHTML(item.name)}</h3>
                    <span class="cart-item__size">
                      SIZE ${escapeHTML(item.size)}
                    </span>
                  </div>

                  <button
                    type="button"
                    class="cart-item__remove"
                    data-remove-cart-item
                    data-id="${escapeHTML(item.id)}"
                    data-size="${escapeHTML(item.size)}"
                    aria-label="Remove ${escapeHTML(item.name)}"
                  >
                    ×
                  </button>
                </div>

                <div class="cart-item__bottom">

                  <div class="cart-quantity">
                    <button
                      type="button"
                      data-cart-minus
                      data-id="${escapeHTML(item.id)}"
                      data-size="${escapeHTML(item.size)}"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <span>${item.quantity}</span>

                    <button
                      type="button"
                      data-cart-plus
                      data-id="${escapeHTML(item.id)}"
                      data-size="${escapeHTML(item.size)}"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <strong>
                    ${formatPrice(item.price * item.quantity)}
                  </strong>

                </div>

              </div>

            </article>
          `).join("")}
        </div>

        <div class="cart-summary">

          <div class="cart-summary__row">
            <span>Subtotal</span>
            <strong>${formatPrice(subtotal)}</strong>
          </div>

          <p class="cart-summary__note">
            Shipping and taxes calculated at checkout.
          </p>

          <button
            type="button"
            class="btn btn--primary cart-checkout"
            data-cart-checkout
          >
            CHECKOUT
          </button>

        </div>
      `;
    });
  }

  /* -------------------------------------------------------
     CART DRAWER
  ------------------------------------------------------- */

  function toggleCartDrawer(open) {
    const drawer = document.querySelector("[data-cart-drawer]");

    if (!drawer) return;

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !drawer.classList.contains("is-open");

    drawer.classList.toggle("is-open", shouldOpen);
    drawer.setAttribute("aria-hidden", String(!shouldOpen));

    document.body.classList.toggle(
      "cart-drawer-open",
      shouldOpen
    );

    if (shouldOpen) {
      renderCartDrawer();

      const firstFocusable = drawer.querySelector(
        "button, a, input, [tabindex]:not([tabindex='-1'])"
      );

      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    }
  }

  /* -------------------------------------------------------
     EVENT DELEGATION
  ------------------------------------------------------- */

  document.addEventListener("click", event => {

    const addButton = event.target.closest("[data-add-to-cart]");

    if (addButton) {
      event.preventDefault();

      let product = {};

      try {
        product = JSON.parse(
          addButton.getAttribute("data-product") || "{}"
        );
      } catch {
        console.error("BULKKOT Cart: Invalid product data.");
      }

      const size =
        addButton.getAttribute("data-size") ||
        document.querySelector("[data-product-size].is-selected")
          ?.getAttribute("data-product-size") ||
        document.querySelector("[data-product-size]:checked")
          ?.value;

      if (!size) {
        alert("Please select a size.");
        return;
      }

      addToCart(product, size);
      toggleCartDrawer(true);

      return;
    }

    const plusButton = event.target.closest("[data-cart-plus]");

    if (plusButton) {
      updateQuantity(
        plusButton.dataset.id,
        plusButton.dataset.size,
        1
      );

      return;
    }

    const minusButton = event.target.closest("[data-cart-minus]");

    if (minusButton) {
      updateQuantity(
        minusButton.dataset.id,
        minusButton.dataset.size,
        -1
      );

      return;
    }

    const removeButton = event.target.closest(
      "[data-remove-cart-item]"
    );

    if (removeButton) {
      removeFromCart(
        removeButton.dataset.id,
        removeButton.dataset.size
      );

      return;
    }

    const openCartButton = event.target.closest(
      "[data-open-cart]"
    );

    if (openCartButton) {
      event.preventDefault();
      toggleCartDrawer(true);
      return;
    }

    const closeCartButton = event.target.closest(
      "[data-close-cart]"
    );

    if (closeCartButton) {
      event.preventDefault();
      toggleCartDrawer(false);
      return;
    }

    const checkoutButton = event.target.closest(
      "[data-cart-checkout]"
    );

    if (checkoutButton) {
      event.preventDefault();

      const cart = getCart();

      if (!cart.length) return;

      document.dispatchEvent(
        new CustomEvent("bulkkot:checkout", {
          detail: {
            cart,
            subtotal: calculateSubtotal()
          }
        })
      );
    }
  });

  /* -------------------------------------------------------
     CLOSE CART WITH ESC
  ------------------------------------------------------- */

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      toggleCartDrawer(false);
    }
  });

  /* -------------------------------------------------------
     SAFE HTML
  ------------------------------------------------------- */

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* -------------------------------------------------------
     INITIALIZE
  ------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    renderCartDrawer();
  });

  /* -------------------------------------------------------
     PUBLIC API
  ------------------------------------------------------- */

  window.BULKKOTCart = {
    getCart,
    saveCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    calculateSubtotal,
    updateCartBadge,
    renderCartDrawer,
    toggleCartDrawer
  };

})();
