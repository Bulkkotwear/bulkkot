/* =========================================================
   BULKKOT (불꽃) — CART SYSTEM
   File: js/cart.js
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "bulkkot_cart";

  /* ---------------------------------------------------------
     Helpers
  --------------------------------------------------------- */

  function normalizeCartItem(product, size) {
    if (!product || !product.id) {
      throw new Error("A valid product with an id is required.");
    }

    return {
      id: String(product.id),
      name: product.name || "BULKKOT Product",
      price: Number(product.price) || 0,
      image: product.image || "",
      size: size || "One Size",
      quantity: Number(product.quantity) > 0 ? Number(product.quantity) : 1
    };
  }

  function formatPrice(value) {
    const amount = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ---------------------------------------------------------
     LocalStorage
  --------------------------------------------------------- */

  function getCart() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("BULKKOT cart read error:", error);
      return [];
    }
  }

  function saveCart(cart) {
    const safeCart = Array.isArray(cart) ? cart : [];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeCart));
    } catch (error) {
      console.error("BULKKOT cart save error:", error);
    }

    updateCartBadge();
    renderCartDrawer();

    document.dispatchEvent(
      new CustomEvent("bulkkot:cart-updated", {
        detail: {
          cart: safeCart
        }
      })
    );
  }

  /* ---------------------------------------------------------
     Add Product
  --------------------------------------------------------- */

  function addToCart(product, size) {
    try {
      const item = normalizeCartItem(product, size);
      const cart = getCart();

      const existingItem = cart.find(
        (cartItem) =>
          String(cartItem.id) === item.id &&
          String(cartItem.size) === item.size
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        cart.push(item);
      }

      saveCart(cart);

      toggleCartDrawer(true);

      return cart;
    } catch (error) {
      console.error("BULKKOT addToCart error:", error);
      return getCart();
    }
  }

  /* ---------------------------------------------------------
     Quantity
  --------------------------------------------------------- */

  function updateQuantity(id, size, delta) {
    const cart = getCart();

    const item = cart.find(
      (cartItem) =>
        String(cartItem.id) === String(id) &&
        String(cartItem.size) === String(size)
    );

    if (!item) {
      return cart;
    }

    item.quantity += Number(delta) || 0;

    if (item.quantity <= 0) {
      const updatedCart = cart.filter(
        (cartItem) =>
          !(
            String(cartItem.id) === String(id) &&
            String(cartItem.size) === String(size)
          )
      );

      saveCart(updatedCart);
      return updatedCart;
    }

    saveCart(cart);

    return cart;
  }

  /* ---------------------------------------------------------
     Remove
  --------------------------------------------------------- */

  function removeFromCart(id, size) {
    const cart = getCart();

    const updatedCart = cart.filter(
      (cartItem) =>
        !(
          String(cartItem.id) === String(id) &&
          String(cartItem.size) === String(size)
        )
    );

    saveCart(updatedCart);

    return updatedCart;
  }

  /* ---------------------------------------------------------
     Subtotal
  --------------------------------------------------------- */

  function calculateSubtotal() {
    return getCart().reduce((total, item) => {
      return (
        total +
        (Number(item.price) || 0) *
          (Number(item.quantity) || 0)
      );
    }, 0);
  }

  /* ---------------------------------------------------------
     Cart Badge
  --------------------------------------------------------- */

  function updateCartBadge() {
    const cart = getCart();

    const count = cart.reduce(
      (total, item) => total + (Number(item.quantity) || 0),
      0
    );

    document.querySelectorAll(
      ".cart-count, [data-cart-count]"
    ).forEach((element) => {
      element.textContent = count;

      element.hidden = count <= 0;

      element.setAttribute(
        "aria-label",
        `${count} item${count === 1 ? "" : "s"} in cart`
      );
    });

    return count;
  }

  /* ---------------------------------------------------------
     Cart Drawer
  --------------------------------------------------------- */

  function renderCartDrawer() {
    const cart = getCart();

    const drawerBodies = document.querySelectorAll(
      ".drawer__body"
    );

    const cartContents = document.querySelectorAll(
      "#cart-content"
    );

    const targets = [
      ...drawerBodies,
      ...cartContents
    ];

    if (!targets.length) {
      return;
    }

    if (!cart.length) {
      const emptyMarkup = `
        <div class="cart-empty">
          <span class="cart-empty__eyebrow">BULKKOT</span>
          <h3>Your cart is empty.</h3>
          <p>Discover the latest essentials from BULKKOT.</p>
          <button
            type="button"
            class="button button--primary"
            data-close-cart
          >
            CONTINUE SHOPPING
          </button>
        </div>
      `;

      targets.forEach((target) => {
        target.innerHTML = emptyMarkup;
      });

      return;
    }

    const itemsMarkup = cart
      .map((item) => {
        const lineTotal =
          (Number(item.price) || 0) *
          (Number(item.quantity) || 0);

        return `
          <article class="cart-item">
            <div class="cart-item__image">
              ${
                item.image
                  ? `<img
                      src="${escapeHTML(item.image)}"
                      alt="${escapeHTML(item.name)}"
                      loading="lazy"
                    >`
                  : `<div class="cart-item__image-placeholder">
                      불꽃
                    </div>`
              }
            </div>

            <div class="cart-item__details">
              <div class="cart-item__top">
                <h4>${escapeHTML(item.name)}</h4>

                <button
                  type="button"
                  class="cart-item__remove"
                  data-cart-remove
                  data-id="${escapeHTML(item.id)}"
                  data-size="${escapeHTML(item.size)}"
                  aria-label="Remove ${escapeHTML(item.name)}"
                >
                  ×
                </button>
              </div>

              <p class="cart-item__meta">
                Size: ${escapeHTML(item.size)}
              </p>

              <div class="cart-item__bottom">
                <div class="cart-quantity">
                  <button
                    type="button"
                    data-cart-quantity
                    data-id="${escapeHTML(item.id)}"
                    data-size="${escapeHTML(item.size)}"
                    data-delta="-1"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>

                  <span>${item.quantity}</span>

                  <button
                    type="button"
                    data-cart-quantity
                    data-id="${escapeHTML(item.id)}"
                    data-size="${escapeHTML(item.size)}"
                    data-delta="1"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <strong>${formatPrice(lineTotal)}</strong>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    const subtotal = calculateSubtotal();

    const markup = `
      <div class="cart-list">
        ${itemsMarkup}
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
          class="button button--primary button--full"
          data-cart-checkout
        >
          CHECKOUT
        </button>
      </div>
    `;

    targets.forEach((target) => {
      target.innerHTML = markup;
    });
  }

  /* ---------------------------------------------------------
     Drawer Controls
  --------------------------------------------------------- */

  function toggleCartDrawer(open) {
    const drawer =
      document.querySelector("[data-cart-drawer]") ||
      document.querySelector("#cart-drawer");

    if (!drawer) {
      return;
    }

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !drawer.classList.contains("is-open");

    drawer.classList.toggle("is-open", shouldOpen);
    drawer.setAttribute("aria-hidden", String(!shouldOpen));

    document.body.classList.toggle(
      "drawer-open",
      shouldOpen
    );

    if (shouldOpen) {
      renderCartDrawer();

      const focusTarget =
        drawer.querySelector(
          "[data-close-cart], button, a"
        );

      if (focusTarget) {
        setTimeout(() => focusTarget.focus(), 100);
      }
    }
  }

  /* ---------------------------------------------------------
     Event Delegation
  --------------------------------------------------------- */

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest(
      "[data-add-to-cart]"
    );

    if (addButton) {
      event.preventDefault();

      let product = {};

      try {
        product = JSON.parse(
          addButton.getAttribute("data-product") || "{}"
        );
      } catch (error) {
        console.error("Invalid product JSON:", error);
      }

      const size =
        addButton.getAttribute("data-size") ||
        document.querySelector(
          "[data-product-size].is-selected"
        )?.getAttribute("data-product-size") ||
        "One Size";

      addToCart(product, size);

      return;
    }

    const quantityButton = event.target.closest(
      "[data-cart-quantity]"
    );

    if (quantityButton) {
      event.preventDefault();

      updateQuantity(
        quantityButton.dataset.id,
        quantityButton.dataset.size,
        Number(quantityButton.dataset.delta)
      );

      return;
    }

    const removeButton = event.target.closest(
      "[data-cart-remove]"
    );

    if (removeButton) {
      event.preventDefault();

      removeFromCart(
        removeButton.dataset.id,
        removeButton.dataset.size
      );

      return;
    }

    const openButton = event.target.closest(
      "[data-open-cart]"
    );

    if (openButton) {
      event.preventDefault();
      toggleCartDrawer(true);
      return;
    }

    const closeButton = event.target.closest(
      "[data-close-cart]"
    );

    if (closeButton) {
      event.preventDefault();
      toggleCartDrawer(false);
      return;
    }

    const checkoutButton = event.target.closest(
      "[data-cart-checkout]"
    );

    if (checkoutButton) {
      event.preventDefault();

      document.dispatchEvent(
        new CustomEvent("bulkkot:checkout", {
          detail: {
            cart: getCart(),
            subtotal: calculateSubtotal()
          }
        })
      );

      console.info(
        "BULKKOT checkout hook ready. Connect your payment backend here."
      );
    }
  });

  /* ---------------------------------------------------------
     Escape
  --------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleCartDrawer(false);
    }
  });

  /* ---------------------------------------------------------
     Initialization
  --------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    renderCartDrawer();
  });

  /* ---------------------------------------------------------
     Public API
  --------------------------------------------------------- */

  window.BULKKOT_CART = {
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

  // Backward-compatible global functions
  window.getCart = getCart;
  window.saveCart = saveCart;
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.removeFromCart = removeFromCart;
  window.calculateSubtotal = calculateSubtotal;
  window.updateCartBadge = updateCartBadge;
  window.renderCartDrawer = renderCartDrawer;
  window.toggleCartDrawer = toggleCartDrawer;
})();
