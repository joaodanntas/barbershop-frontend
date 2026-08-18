// ===== Configuração =====
const API_BASE_URL = "https://barbershop-api-acij.onrender.com";

// ===== Auth helpers =====
function getToken() { return localStorage.getItem("bs_token"); }
function getUser() {
  const raw = localStorage.getItem("bs_user");
  return raw ? JSON.parse(raw) : null;
}
function saveSession(token, nome, email, perfil) {
  localStorage.setItem("bs_token", token);
  localStorage.setItem("bs_user", JSON.stringify({ nome, email, perfil }));
}
function clearSession() {
  localStorage.removeItem("bs_token");
  localStorage.removeItem("bs_user");
}
function isLoggedIn() { return !!getToken(); }
function isClienteLogado() {
  const user = getUser();
  return !!(user && user.perfil === "Cliente");
}

// ===== Segurança =====
function escapeHtml(texto) {
  if (texto === null || texto === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}

// ===== Fetch wrapper =====
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch (e) { /* corpo vazio */ }

  // Rotas de auth são públicas — um 401 nelas é "senha errada", não "sessão expirada"
  const isRotaAuth = path.startsWith("/api/auth/");

  if (res.status === 401 && token && !isRotaAuth) {
    // Tínhamos um token e mesmo assim veio 401: o token expirou ou foi invalidado.
    clearSession();
    setTimeout(() => location.reload(), 1500);
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }

  if (!res.ok) {
    const msg = (data && (data.erro || data.title)) || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ===== Toast =====
let toastToken = 0;
function toast(message, isError = false) {
  const el = document.getElementById("toast");
  if (!el) return;
  const meuToken = ++toastToken;
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  setTimeout(() => {
    if (meuToken === toastToken) el.classList.remove("show");
  }, 2000);
}

// ===== Password Toggle =====
function setupPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.target);
      const img = btn.querySelector("img");
      if (!input || !img) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      img.src = isPassword ? "assets/notsee-eye.svg" : "assets/see-eye.svg";
      img.alt = isPassword ? "Ocultar senha" : "Mostrar senha";
    };
  });
}

// ===== Formatters =====
function parseFakeUtc(iso) {
  // Extrai os componentes direto da string, ignorando o "Z" (que é falso-UTC)
  // "2026-07-21T09:00:00Z" -> { day: 21, month: 7, hour: 9, minute: 0 }
  const [, , day, hour, minute] = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/) || [];
  const match = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour: match[4],
    minute: match[5],
  };
}

function formatDateTime(iso) {
  const p = parseFakeUtc(iso);
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

function formatTime(iso) {
  const p = parseFakeUtc(iso);
  return `${p.hour}:${p.minute}`;
}
function formatMoney(v) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDateOnly(dateStr) {
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  const [, year, month, day] = match;
  return `${day}/${month}`;
}
function statusLabel(status, canceladoPor) {
  if (status === "Cancelado" && canceladoPor) {
    return canceladoPor === "Barbeiro" ? "Cancelado pelo barbeiro" : "Cancelado pelo cliente";
  }
  return { Pendente: "Pendente", Confirmado: "Confirmado", Cancelado: "Cancelado" }[status] || status;
}
// ===== Processamento de foto (crop quadrado + redimensionamento) =====
function processarImagemParaBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("O arquivo selecionado não é uma imagem."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const TAMANHO = 300; // px, lado do quadrado final
        const menorLado = Math.min(img.width, img.height);
        const offsetX = (img.width - menorLado) / 2;
        const offsetY = (img.height - menorLado) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = TAMANHO;
        canvas.height = TAMANHO;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, offsetX, offsetY, menorLado, menorLado, 0, 0, TAMANHO, TAMANHO);

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}