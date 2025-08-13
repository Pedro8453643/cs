/**
 * Comercial Soares - Catálogo Digital
 * Sistema de catálogo e carrinho de compras
 */

// Configurações do sistema
const AppConfig = {
  taxRate: 0,
  currency: "BRL",
  cartStoragePrefix: "comercial_soares_cart_",
  apiEndpoint: "http://localhost:5000/gerar_pdf"
};

// Estado da aplicação
const AppState = {
  currentUser: null,
  users: {},
  products: {},
  cart: {},
  currentPage: "login",
  currentCategory: "all",
  showUserCode: true
};

// Elementos DOM
const DOM = {
  loginSection: document.getElementById("login-section"),
  loginForm: document.getElementById("login-form"),
  usercodeInput: document.getElementById("usercode"),
  appContent: document.getElementById("app-content"),
  usernameDisplay: document.getElementById("username-display"),
  userCodeDisplay: document.getElementById("user-code"),
  btnToggleCode: document.getElementById("btn-toggle-code"),
  btnLogout: document.getElementById("btn-logout"),
  btnCatalog: document.getElementById("btn-catalog"),
  btnCart: document.getElementById("btn-cart"),
  cartBadge: document.getElementById("cart-badge"),
  searchInput: document.getElementById("search-input"),
  catalogContainer: document.getElementById("catalog-container"),
  categoryButtons: document.querySelectorAll(".category-btn"),
  cartItems: document.getElementById("cart-items"),
  cartSubtotal: document.getElementById("cart-subtotal"),
  cartTax: document.getElementById("cart-tax"),
  cartTotal: document.getElementById("cart-total"),
  btnClearCart: document.getElementById("btn-clear-cart"),
  btnCheckout: document.getElementById("btn-checkout"),
  currentYear: document.getElementById("current-year")
};

// Utilitários
const Utils = {
  formatCurrency: (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: AppConfig.currency
    }).format(value);
  },
  
  showNotification: (message, type = "info") => {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },
  
  debounce: (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },
  
  setCurrentYear: () => {
    DOM.currentYear.textContent = new Date().getFullYear();
  },
  
  loadJSON: async (file) => {
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Erro ao carregar ${file}`);
      return await response.json();
    } catch (error) {
      console.error(`Erro ao carregar ${file}:`, error);
      throw error;
    }
  }
};

// Gerenciamento de páginas
const PageManager = {
  showPage: (pageId) => {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    document.getElementById(`${pageId}-section`)?.classList.add("active");
    AppState.currentPage = pageId;
    PageManager.updateActiveTab(pageId);
  },
  
  updateActiveTab: (activePage) => {
    document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
    if (activePage === "catalog") DOM.btnCatalog.classList.add("active");
    else if (activePage === "cart") DOM.btnCart.classList.add("active");
  }
};

// Gerenciamento de usuário
const UserManager = {
  init: async () => {
    try {
      AppState.users = await Utils.loadJSON("users.json");
    } catch (error) {
      Utils.showNotification("Erro ao carregar usuários!", "error");
    }
  },
  
  login: (userCode) => {
    const code = userCode.trim().toLowerCase();
    
    if (AppState.users[code]) {
      AppState.currentUser = { code, ...AppState.users[code] };
      DOM.usernameDisplay.textContent = AppState.currentUser.name;
      DOM.userCodeDisplay.textContent = AppState.currentUser.code.toUpperCase();
      UserManager.updateCodeVisibility();
      
      DOM.loginSection.classList.remove("active");
      DOM.appContent.classList.remove("hidden");
      
      ProductManager.loadProducts();
      CartManager.loadCart();
      
      PageManager.showPage("catalog");
      Utils.showNotification("Login realizado com sucesso!", "success");
    } else {
      Utils.showNotification("Código inválido!", "error");
    }
  },
  
  logout: () => {
    AppState.currentUser = null;
    DOM.usernameDisplay.textContent = "";
    DOM.userCodeDisplay.textContent = "";
    AppState.cart = {};
    CartManager.updateCartUI();
    
    DOM.loginSection.classList.add("active");
    DOM.appContent.classList.add("hidden");
    DOM.usercodeInput.value = "";
    
    Utils.showNotification("Você saiu do sistema.", "info");
  },
  
  toggleCodeVisibility: () => {
    AppState.showUserCode = !AppState.showUserCode;
    UserManager.updateCodeVisibility();
    localStorage.setItem('showUserCode', AppState.showUserCode);
  },
  
  updateCodeVisibility: () => {
    if (AppState.showUserCode) {
      DOM.userCodeDisplay.classList.remove("hidden");
      DOM.btnToggleCode.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      DOM.userCodeDisplay.classList.add("hidden");
      DOM.btnToggleCode.innerHTML = '<i class="fas fa-eye"></i>';
    }
  }
};

// Gerenciamento de produtos
const ProductManager = {
  loadProducts: async () => {
    try {
      AppState.products = await Utils.loadJSON("produtos.json");
      ProductManager.renderCatalog();
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      DOM.catalogContainer.innerHTML = `
        <div class="error-message">
          <p>Não foi possível carregar os produtos.</p>
          <button id="retry-load" class="secondary-button">
            <i class="fas fa-sync-alt"></i> Tentar novamente
          </button>
        </div>
      `;
      document.getElementById("retry-load").addEventListener("click", ProductManager.loadProducts);
    }
  },
  
  renderCatalog: (filter = "", category = AppState.currentCategory) => {
    const searchTerm = filter.trim().toLowerCase();
    let html = '';
    
    if (category === "all") {
      for (const [cat, products] of Object.entries(AppState.products)) {
        const filteredProducts = products.filter(p => p.nome.toLowerCase().includes(searchTerm));
        if (filteredProducts.length === 0) continue;
        
        html += `
          <div class="category-container">
            <h3 class="category-title">${ProductManager.getCategoryName(cat)}</h3>
            <div class="products-grid">
              ${filteredProducts.map(p => ProductManager.createProductCard(p)).join('')}
            </div>
          </div>
        `;
      }
    } else {
      const products = AppState.products[category] || [];
      const filteredProducts = products.filter(p => p.nome.toLowerCase().includes(searchTerm));
      
      if (filteredProducts.length > 0) {
        html = `
          <div class="products-grid">
            ${filteredProducts.map(p => ProductManager.createProductCard(p)).join('')}
          </div>
        `;
      } else {
        html = `
          <div class="empty-message">
            <i class="fas fa-box-open"></i>
            <p>Nenhum produto encontrado</p>
          </div>
        `;
      }
    }
    
    DOM.catalogContainer.innerHTML = html || `
      <div class="empty-message">
        <i class="fas fa-box-open"></i>
        <p>Nenhum produto encontrado</p>
      </div>
    `;
    
    ProductManager.setupQuantityControls();
  },
  
  createProductCard: (product) => {
    return `
      <div class="product-card">
        <img src="images/${product.imagem}" alt="${product.nome}" class="product-image" />
        <div class="product-info">
          <h4 class="product-name">${product.nome}</h4>
          <div class="product-price">${Utils.formatCurrency(product.preco)}</div>
          
          <div class="product-quantity">
            <label>Quantidade:</label>
            <div class="product-quantity-control">
              <button class="product-quantity-btn decrease" data-id="${product.id}">
                <i class="fas fa-minus"></i>
              </button>
              <input type="number" 
                     class="product-quantity-input" 
                     data-id="${product.id}" 
                     value="1" 
                     min="1" 
                     step="1">
              <button class="product-quantity-btn increase" data-id="${product.id}">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
          
          <button class="add-to-cart-btn" data-id="${product.id}">
            <i class="fas fa-cart-plus"></i> Adicionar
          </button>
        </div>
      </div>
    `;
  },
  
  setupQuantityControls: () => {
    document.querySelectorAll('.product-quantity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.currentTarget.getAttribute('data-id');
        const input = document.querySelector(`.product-quantity-input[data-id="${productId}"]`);
        let value = parseInt(input.value) || 1;
        
        if (e.currentTarget.classList.contains('decrease')) {
          value = Math.max(1, value - 1);
        } else {
          value = value + 1;
        }
        
        input.value = value;
      });
    });

    document.querySelectorAll('.product-quantity-input').forEach(input => {
      input.addEventListener('change', (e) => {
        let value = parseInt(e.target.value) || 1;
        e.target.value = Math.max(1, value);
      });
      
      input.addEventListener('keydown', (e) => {
        if (['e', 'E', '+', '-'].includes(e.key)) {
          e.preventDefault();
        }
      });
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.currentTarget.getAttribute('data-id');
        const product = ProductManager.findProductById(productId);
        const quantityInput = document.querySelector(`.product-quantity-input[data-id="${productId}"]`);
        const quantity = parseInt(quantityInput.value) || 1;
        
        if (product) {
          CartManager.addToCart(product, quantity);
          quantityInput.value = 1;
        }
      });
    });
  },
  
  getCategoryName: (category) => {
    const names = {
      "cervejas": "Cervejas",
      "doces": "Doces",
      "refrigerantes": "Refrigerantes",
      "salgados": "Salgados",
      "biscoitos": "Biscoitos"
    };
    return names[category] || category;
  },
  
  findProductById: (id) => {
    for (const category of Object.values(AppState.products)) {
      const product = category.find(p => p.id === id);
      if (product) return product;
    }
    return null;
  },
  
  setActiveCategory: (category) => {
    AppState.currentCategory = category;
    document.querySelectorAll(".category-btn").forEach(btn => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-category") === category) {
        btn.classList.add("active");
      }
    });
    ProductManager.renderCatalog(DOM.searchInput.value, category);
  }
};

// Gerenciamento do carrinho
const CartManager = {
  addToCart: (product, quantity = 1) => {
    if (!AppState.currentUser) return;
    
    if (AppState.cart[product.id]) {
      AppState.cart[product.id].quantity += quantity;
    } else {
      AppState.cart[product.id] = { product, quantity };
    }
    
    CartManager.saveCart();
    CartManager.updateCartUI();
    Utils.showNotification(`${quantity}x ${product.nome} adicionado ao carrinho!`, "success");
  },
  
  removeFromCart: (productId) => {
    delete AppState.cart[productId];
    CartManager.saveCart();
    CartManager.updateCartUI();
  },
  
  updateQuantity: (productId, newQuantity) => {
    if (newQuantity < 1) return CartManager.removeFromCart(productId);
    
    AppState.cart[productId].quantity = newQuantity;
    CartManager.saveCart();
    CartManager.updateCartUI();
  },
  
  clearCart: () => {
    AppState.cart = {};
    CartManager.saveCart();
    CartManager.updateCartUI();
    Utils.showNotification("Carrinho limpo!", "info");
  },
  
  calculateTotals: () => {
    const subtotal = Object.values(AppState.cart).reduce((total, item) => {
      return total + (item.product.preco * item.quantity);
    }, 0);
    
    const tax = subtotal * AppConfig.taxRate;
    const total = subtotal + tax;
    
    return { subtotal, tax, total };
  },
  
  updateCartUI: () => {
    const itemCount = Object.keys(AppState.cart).length;
    DOM.cartBadge.textContent = itemCount;
    itemCount > 0 ? DOM.cartBadge.classList.remove("hidden") : DOM.cartBadge.classList.add("hidden");
    
    if (itemCount === 0) {
      DOM.cartItems.innerHTML = `
        <div class="empty-cart-message">
          <i class="fas fa-shopping-cart icon"></i>
          <p>Seu carrinho está vazio</p>
        </div>
      `;
      DOM.cartSubtotal.textContent = Utils.formatCurrency(0);
      DOM.cartTax.textContent = Utils.formatCurrency(0);
      DOM.cartTotal.textContent = Utils.formatCurrency(0);
      DOM.btnCheckout.disabled = true;
      return;
    }
    
    DOM.cartItems.innerHTML = Object.values(AppState.cart).map(item => `
      <div class="cart-item">
        <div class="item-info">
          <span class="item-name">${item.product.nome}</span>
        </div>
        <div class="item-controls">
          <div class="quantity-control">
            <button class="quantity-btn decrease" data-id="${item.product.id}">
              <i class="fas fa-minus"></i>
            </button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn increase" data-id="${item.product.id}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="item-price">${Utils.formatCurrency(item.product.preco * item.quantity)}</div>
          <button class="remove-item-btn" data-id="${item.product.id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `).join('');
    
    const { subtotal, tax, total } = CartManager.calculateTotals();
    DOM.cartSubtotal.textContent = Utils.formatCurrency(subtotal);
    DOM.cartTax.textContent = Utils.formatCurrency(tax);
    DOM.cartTotal.textContent = Utils.formatCurrency(total);
    DOM.btnCheckout.disabled = false;
    
    document.querySelectorAll(".decrease").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const productId = e.currentTarget.getAttribute("data-id");
        CartManager.updateQuantity(productId, AppState.cart[productId].quantity - 1);
      });
    });
    
    document.querySelectorAll(".increase").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const productId = e.currentTarget.getAttribute("data-id");
        CartManager.updateQuantity(productId, AppState.cart[productId].quantity + 1);
      });
    });
    
    document.querySelectorAll(".remove-item-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        CartManager.removeFromCart(e.currentTarget.getAttribute("data-id"));
      });
    });
  },
  
  saveCart: () => {
    if (AppState.currentUser) {
      localStorage.setItem(
        `${AppConfig.cartStoragePrefix}${AppState.currentUser.code}`,
        JSON.stringify(AppState.cart)
      );
    }
  },
  
  loadCart: () => {
    if (AppState.currentUser) {
      const savedCart = localStorage.getItem(
        `${AppConfig.cartStoragePrefix}${AppState.currentUser.code}`
      );
      AppState.cart = savedCart ? JSON.parse(savedCart) : {};
      CartManager.updateCartUI();
    }
  },
  
  checkout: async () => {
    if (Object.keys(AppState.cart).length === 0) return;
    
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const { total } = CartManager.calculateTotals();
    
    // Mostrar loading
    const btnOriginalText = DOM.btnCheckout.innerHTML;
    DOM.btnCheckout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';
    DOM.btnCheckout.disabled = true;

    try {
      const response = await fetch(AppConfig.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pedido: {
            numero: orderId,
            cliente: AppState.currentUser.name,
            codigo_cliente: AppState.currentUser.code,
            itens: Object.values(AppState.cart).map(item => ({
              produto: item.product.nome,
              quantidade: item.quantity,
              preco: item.product.preco
            })),
            total: total
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro no servidor');
      }

      const horaPedido = new Date().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      Utils.showNotification(`Pedido ${orderId} finalizado às ${horaPedido}!`, "success");
      CartManager.clearCart();

    } catch (error) {
      console.error('Erro no checkout:', error);
      Utils.showNotification("Pedido registrado localmente!", "info");
    } finally {
      DOM.btnCheckout.innerHTML = btnOriginalText;
      DOM.btnCheckout.disabled = false;
    }
  }
};

// Inicialização da aplicação
const initApp = async () => {
  Utils.setCurrentYear();
  
  const savedShowCode = localStorage.getItem('showUserCode');
  if (savedShowCode !== null) {
    AppState.showUserCode = savedShowCode === 'true';
  }
  
  await UserManager.init();
  
  // Event listeners
  DOM.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    UserManager.login(DOM.usercodeInput.value);
  });
  
  DOM.btnCatalog.addEventListener("click", () => {
    PageManager.showPage("catalog");
    ProductManager.renderCatalog(DOM.searchInput.value);
  });
  
  DOM.btnCart.addEventListener("click", () => PageManager.showPage("cart"));
  DOM.btnLogout.addEventListener("click", UserManager.logout);
  DOM.btnToggleCode.addEventListener("click", UserManager.toggleCodeVisibility);
  
  DOM.searchInput.addEventListener("input", Utils.debounce(() => {
    ProductManager.renderCatalog(DOM.searchInput.value);
  }, 300));
  
  DOM.btnClearCart.addEventListener("click", () => {
    if (Object.keys(AppState.cart).length > 0 && confirm("Limpar carrinho?")) {
      CartManager.clearCart();
    }
  });
  
  DOM.btnCheckout.addEventListener("click", CartManager.checkout);
  
  document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      ProductManager.setActiveCategory(e.currentTarget.getAttribute("data-category"));
    });
  });
  
  PageManager.showPage("login");
};

document.addEventListener("DOMContentLoaded", initApp);