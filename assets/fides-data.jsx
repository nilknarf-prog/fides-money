// fides-data.jsx — mock data + shared utilities + icon set
// All icon components are Lucide-inspired, stroke=1.6, rounded.

// ─── Money formatters ─────────────────────────────────────────
const fmtBRL = (n, opts = {}) => {
  const { sign = false, compact = false } = opts;
  if (compact && Math.abs(n) >= 1000) {
    const v = (n / 1000).toFixed(n >= 10000 ? 0 : 1);
    return (sign && n > 0 ? '+' : '') + 'R$\u00a0' + v + 'k';
  }
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = n < 0 ? '−R$\u00a0' : (sign && n > 0 ? '+R$\u00a0' : 'R$\u00a0');
  return prefix + s;
};
const fmtPct = (n, opts = {}) => {
  const { sign = true } = opts;
  const s = Math.abs(n).toFixed(1) + '%';
  return n < 0 ? '−' + s : (sign && n > 0 ? '+' + s : s);
};

// Split a BRL formatted string into [currency, integer, decimal] so we can
// style each part — common in fintech to de-emphasize the cents.
function splitBRL(n) {
  const negative = n < 0;
  const abs = Math.abs(n);
  const [int, dec] = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',');
  return { sign: negative ? '−' : '', currency: 'R$', int, dec };
}

// ─── Mock data ────────────────────────────────────────────────
const USER = { name: 'Deyglison', initials: 'DF', email: 'deyglison@fides.app', plan: 'Pro' };

const ACCOUNTS = [
  { id: 'bradesco', name: 'Bradesco', tag: '5309', balance: 4218.30, type: 'corrente', color: '#CC092F' },
  { id: 'nubank', name: 'Nubank', tag: '8421', balance: 1892.44, type: 'corrente', color: '#820AD1' },
  { id: 'infinity', name: 'InfinityPay', tag: '0021', balance: 700.12, type: 'digital', color: '#0F172A' },
];

const CARDS = [
  { id: 'nu',    name: 'Nubank Ultravioleta', tag: '••8421', limit: 12000, used: 3284.12, due: '15/jun',
    diaFechamento: 5,  diaVencimento: 15, color: '#820AD1' },
  { id: 'inter', name: 'Inter Black',         tag: '••3120', limit:  8000, used: 1207.99, due: '02/jun',
    diaFechamento: 22, diaVencimento: 2,  color: '#FF7A00' },
];

// Auxiliares de data
const txMonth = (t) => t.mes || `2026-${String(t.d).split('/')[1]}`;
const ymOf    = (y, m) => `${y}-${String(m).padStart(2,'0')}`;

// Dada uma data dd/mm e um cartão, devolve o YYYY-MM do mês em que
// a fatura VENCE. Leva em conta diaFechamento + diaVencimento.
function mesFaturaFor(dStr, card, year = 2026) {
  if (!card) return null;
  const [dd, mm] = String(dStr).split('/').map(s => parseInt(s, 10));
  if (!dd || !mm) return null;
  const fechamento = card.diaFechamento || 5;
  const vencimento = card.diaVencimento || 15;
  // mês em que a compra fecha
  let monthClose = mm;
  if (dd > fechamento) monthClose = mm + 1;
  // se diaVencimento < diaFechamento, vence no mês seguinte ao do fechamento
  let monthDue = monthClose + (vencimento < fechamento ? 1 : 0);
  let y = year;
  while (monthDue > 12) { monthDue -= 12; y += 1; }
  return ymOf(y, monthDue);
}

// Verifica se uma conta/cartão id é cartão de crédito (vs débito)
const isCardId = (acctId) => CARDS.some(c => c.id === acctId);

const CATEGORIES = {
  salario:     { label: 'Salário',     group: 'receita',   tint: '#10B981', emoji: '💰' },
  freelance:   { label: 'Freelance',   group: 'receita',   tint: '#0EA5E9', emoji: '💻' },
  mercado:     { label: 'Mercado',     group: 'essencial', tint: '#F59E0B', emoji: '🛒' },
  alimentacao: { label: 'Alimentação', group: 'essencial', tint: '#EF4444', emoji: '🍽️' },
  combustivel: { label: 'Combustível', group: 'essencial', tint: '#DC2626', emoji: '⛽' },
  carro:       { label: 'Carro',       group: 'essencial', tint: '#7C3AED', emoji: '🚗' },
  celular:     { label: 'Celular',     group: 'essencial', tint: '#0EA5E9', emoji: '📱' },
  saude:       { label: 'Saúde',       group: 'essencial', tint: '#16A34A', emoji: '💊' },
  casa:        { label: 'Casa',        group: 'essencial', tint: '#F97316', emoji: '🏠' },
  educacao:    { label: 'Educação',    group: 'essencial', tint: '#0891B2', emoji: '📚' },
  pets:        { label: 'Pets',        group: 'essencial', tint: '#CA8A04', emoji: '🐾' },
  compras:     { label: 'Compras',     group: 'estilo',    tint: '#EC4899', emoji: '🛍️' },
  lazer:       { label: 'Lazer',       group: 'estilo',    tint: '#A855F7', emoji: '🎮' },
  academia:    { label: 'Academia',    group: 'estilo',    tint: '#22C55E', emoji: '💪' },
  assinaturas: { label: 'Assinaturas', group: 'estilo',    tint: '#8B5CF6', emoji: '📺' },
  viagem:      { label: 'Viagem',      group: 'estilo',    tint: '#06B6D4', emoji: '✈️' },
  presentes:   { label: 'Presentes',   group: 'estilo',    tint: '#F43F5E', emoji: '🎁' },
  divida:      { label: 'Dívida',      group: 'divida',    tint: '#B91C1C', emoji: '💳' },
  investimento:{ label: 'Investimento',group: 'divida',    tint: '#0F766E', emoji: '📈' },
  emprestimo:  { label: 'Empréstimo',  group: 'divida',    tint: '#7F1D1D', emoji: '🏦' },
};

// Emoji palette for the category creator picker
const EMOJI_PALETTE = [
  '🛒','🍽️','🍔','☕','⛽','🚗','🚕','🚌','🚲','📱','💻','🖥️',
  '🏠','🏢','🛏️','🛋️','💡','🔌','💊','🏥','🩺','🦷','👶','🐾',
  '📚','🎓','✏️','📓','🛍️','👗','👕','👟','💄','💅','💇','🧴',
  '🎮','🎬','🎵','🎤','🎨','📸','🎂','🍰','🍷','🍺','🎁','💐',
  '✈️','🏖️','🗺️','🚢','🏨','🎫','💪','🧘','⚽','🏀','🎾','🏊',
  '📺','🎧','📡','🔔','💰','💵','💳','🏦','📈','📉','🪙','💼',
  '🎯','📌','⭐','🔥','❤️','🌱','🌳','🌍','🐶','🐱','🐠','🌸',
];

// Transações — Maio 2026 (corrente) + histórico Abr/Mar 2026
// Cartão de crédito usa o id do cartão como `acct` (nu, inter); demais usam contas.
// Cada tx ganha `mes: 'YYYY-MM'` derivado da data de COMPRA — orçamento conta no
// mês em que foi feita, não no mês da fatura.
const TRANSACTIONS = [
  // ── Maio 2026 (mês corrente) ────────────────────────────────
  { d: '30/05', mes: '2026-05', desc: 'Salário PMAM',           cat: 'salario',     acct: 'bradesco', val:  5417.00, status: 'pendente', recur: 'mensal' },
  { d: '28/05', mes: '2026-05', desc: 'Salário TJAM',           cat: 'salario',     acct: 'bradesco', val:  3331.66, status: 'pendente', recur: 'mensal' },
  { d: '24/05', mes: '2026-05', desc: 'Parcela Crédito Pessoal',cat: 'divida',      acct: 'bradesco', val:  -427.37, status: 'pago',     recur: 'mensal' },
  { d: '18/05', mes: '2026-05', desc: 'Renegociação Emp. Ádria',cat: 'divida',      acct: 'nubank',   val:  -302.32, status: 'pendente', sub: '1/47' },
  { d: '15/05', mes: '2026-05', desc: 'Claro',                  cat: 'celular',     acct: 'nubank',   val:  -123.62, status: 'pendente', recur: 'mensal' },
  { d: '13/05', mes: '2026-05', desc: 'Mercado Atacadão',       cat: 'mercado',     acct: 'bradesco', val:  -143.08, status: 'pendente' },
  // Crédito (Nubank fecha dia 5) — compras de Maio entram na fatura de Junho
  { d: '12/05', mes: '2026-05', desc: 'Bolo aniversário Ádria', cat: 'compras',     acct: 'nu',       val:  -159.00, status: 'pendente' },
  { d: '10/05', mes: '2026-05', desc: 'Jantar família Ádria',   cat: 'alimentacao', acct: 'nu',       val:   -79.00, status: 'pendente' },
  { d: '09/05', mes: '2026-05', desc: 'Smart Fit',              cat: 'academia',    acct: 'nu',       val:   -89.90, status: 'pendente', recur: 'mensal' },
  { d: '07/05', mes: '2026-05', desc: 'Netflix',                cat: 'assinaturas', acct: 'nu',       val:   -39.90, status: 'pendente', recur: 'mensal' },
  { d: '06/05', mes: '2026-05', desc: 'Spotify Família',        cat: 'assinaturas', acct: 'nu',       val:   -21.90, status: 'pendente', recur: 'mensal' },
  { d: '03/05', mes: '2026-05', desc: 'Almoço Outback',         cat: 'alimentacao', acct: 'nu',       val:  -118.40, status: 'pendente' },
  // Crédito Inter (fecha dia 22) — compras antes de 22/05 entram na fatura de Junho
  { d: '11/05', mes: '2026-05', desc: 'Carro — manutenção',     cat: 'carro',       acct: 'inter',    val:  -148.25, status: 'pendente' },
  // Débito
  { d: '11/05', mes: '2026-05', desc: 'Pão & frios',            cat: 'mercado',     acct: 'nubank',   val:   -34.78, status: 'pago' },
  { d: '08/05', mes: '2026-05', desc: 'Combustível Shell',      cat: 'combustivel', acct: 'bradesco', val:  -210.00, status: 'pago' },
  { d: '05/05', mes: '2026-05', desc: 'Freela landing page',    cat: 'freelance',   acct: 'infinity', val:  1200.00, status: 'pago' },
  { d: '04/05', mes: '2026-05', desc: 'Farmácia',               cat: 'saude',       acct: 'nubank',   val:   -67.80, status: 'pago' },
  { d: '02/05', mes: '2026-05', desc: 'Mercado Carrefour',      cat: 'mercado',     acct: 'bradesco', val:  -286.55, status: 'pago' },
  { d: '01/05', mes: '2026-05', desc: 'Aluguel',                cat: 'divida',      acct: 'bradesco', val: -1450.00, status: 'pago',     recur: 'mensal' },

  // ── Abril 2026 (histórico) ──────────────────────────────────
  { d: '28/04', mes: '2026-04', desc: 'Salário PMAM',           cat: 'salario',     acct: 'bradesco', val:  5380.00, status: 'pago',     recur: 'mensal' },
  { d: '26/04', mes: '2026-04', desc: 'Salário TJAM',           cat: 'salario',     acct: 'bradesco', val:  3290.00, status: 'pago',     recur: 'mensal' },
  { d: '22/04', mes: '2026-04', desc: 'Parcela Crédito Pessoal',cat: 'divida',      acct: 'bradesco', val:  -427.37, status: 'pago',     recur: 'mensal' },
  { d: '20/04', mes: '2026-04', desc: 'Camiseta nova',          cat: 'compras',     acct: 'nu',       val:  -129.90, status: 'pago' },
  { d: '15/04', mes: '2026-04', desc: 'Claro',                  cat: 'celular',     acct: 'nubank',   val:  -123.62, status: 'pago',     recur: 'mensal' },
  { d: '14/04', mes: '2026-04', desc: 'Restaurante japonês',    cat: 'alimentacao', acct: 'nu',       val:  -187.00, status: 'pago' },
  { d: '12/04', mes: '2026-04', desc: 'Mercado Atacadão',       cat: 'mercado',     acct: 'bradesco', val:  -198.45, status: 'pago' },
  { d: '10/04', mes: '2026-04', desc: 'Combustível Shell',      cat: 'combustivel', acct: 'bradesco', val:  -240.00, status: 'pago' },
  { d: '09/04', mes: '2026-04', desc: 'Smart Fit',              cat: 'academia',    acct: 'nu',       val:   -89.90, status: 'pago',     recur: 'mensal' },
  { d: '07/04', mes: '2026-04', desc: 'Netflix',                cat: 'assinaturas', acct: 'nu',       val:   -39.90, status: 'pago',     recur: 'mensal' },
  { d: '06/04', mes: '2026-04', desc: 'Spotify Família',        cat: 'assinaturas', acct: 'nu',       val:   -21.90, status: 'pago',     recur: 'mensal' },
  { d: '03/04', mes: '2026-04', desc: 'Mercado Carrefour',      cat: 'mercado',     acct: 'bradesco', val:  -312.20, status: 'pago' },
  { d: '01/04', mes: '2026-04', desc: 'Aluguel',                cat: 'divida',      acct: 'bradesco', val: -1450.00, status: 'pago',     recur: 'mensal' },

  // ── Março 2026 (histórico mais esparso) ────────────────────
  { d: '28/03', mes: '2026-03', desc: 'Salário PMAM',           cat: 'salario',     acct: 'bradesco', val:  5380.00, status: 'pago',     recur: 'mensal' },
  { d: '26/03', mes: '2026-03', desc: 'Salário TJAM',           cat: 'salario',     acct: 'bradesco', val:  3290.00, status: 'pago',     recur: 'mensal' },
  { d: '24/03', mes: '2026-03', desc: 'Tênis novo',             cat: 'compras',     acct: 'nu',       val:  -389.00, status: 'pago' },
  { d: '22/03', mes: '2026-03', desc: 'Parcela Crédito Pessoal',cat: 'divida',      acct: 'bradesco', val:  -427.37, status: 'pago',     recur: 'mensal' },
  { d: '15/03', mes: '2026-03', desc: 'Claro',                  cat: 'celular',     acct: 'nubank',   val:  -123.62, status: 'pago',     recur: 'mensal' },
  { d: '12/03', mes: '2026-03', desc: 'Mercado Carrefour',      cat: 'mercado',     acct: 'bradesco', val:  -421.30, status: 'pago' },
  { d: '08/03', mes: '2026-03', desc: 'Combustível Shell',      cat: 'combustivel', acct: 'bradesco', val:  -220.00, status: 'pago' },
  { d: '01/03', mes: '2026-03', desc: 'Aluguel',                cat: 'divida',      acct: 'bradesco', val: -1450.00, status: 'pago',     recur: 'mensal' },
];

// Monthly trend — for area chart
const MONTHLY = [
  { m: 'Jan', rec: 7820, des: 6432 },
  { m: 'Fev', rec: 8100, des: 5912 },
  { m: 'Mar', rec: 7950, des: 7104 },
  { m: 'Abr', rec: 8420, des: 6890 },
  { m: 'Mai', rec: 8748, des: 5832 },
  { m: 'Jun', rec: 8800, des: 6200, future: true },
  { m: 'Jul', rec: 8800, des: 5400, future: true },
];

// Category distribution for current month
const SPEND_BY_CATEGORY = [
  { key: 'divida',      label: 'Dívida',      val: 2179.69, tint: '#B91C1C' },
  { key: 'mercado',     label: 'Mercado',     val:  464.41, tint: '#F59E0B' },
  { key: 'carro',       label: 'Carro',       val:  148.25, tint: '#7C3AED' },
  { key: 'combustivel', label: 'Combustível', val:  210.00, tint: '#DC2626' },
  { key: 'alimentacao', label: 'Alimentação', val:  197.40, tint: '#EF4444' },
  { key: 'compras',     label: 'Compras',     val:  159.00, tint: '#EC4899' },
  { key: 'celular',     label: 'Celular',     val:  123.62, tint: '#0EA5E9' },
  { key: 'academia',    label: 'Academia',    val:   89.90, tint: '#22C55E' },
  { key: 'assinaturas', label: 'Assinaturas', val:   61.80, tint: '#8B5CF6' },
  { key: 'saude',       label: 'Saúde',       val:   67.80, tint: '#16A34A' },
];

const BUDGET_GROUPS = [
  { id: 'essencial', label: 'Essencial',          target: 0.50, spent: 1283.51, limit: 4374.33,
    cats: [
      { cat: 'mercado',     limit:  700, spent: 464.41 },
      { cat: 'alimentacao', limit:  400, spent: 197.40 },
      { cat: 'combustivel', limit:  300, spent: 210.00 },
      { cat: 'carro',       limit:  250, spent: 148.25 },
      { cat: 'celular',     limit:  150, spent: 123.62 },
      { cat: 'saude',       limit:  200, spent:  67.80 },
    ] },
  { id: 'estilo', label: 'Estilo de vida',     target: 0.30, spent:  310.70, limit: 2624.60,
    cats: [
      { cat: 'compras',     limit:  400, spent: 159.00 },
      { cat: 'lazer',       limit:  300, spent:   0 },
      { cat: 'academia',    limit:   90, spent:  89.90 },
      { cat: 'assinaturas', limit:  100, spent:  61.80 },
    ] },
  { id: 'divida', label: 'Dívidas & investimentos', target: 0.20, spent: 2179.69, limit: 1749.73,
    cats: [
      { cat: 'divida',       limit: 1800, spent: 2179.69 },
      { cat: 'investimento', limit:  500, spent:    0 },
    ] },
];

// ─── Metas (savings goals) ────────────────────────────────────
const METAS = [
  {
    id: 'reserva',
    nome: 'Reserva de emergência',
    descricao: '6 meses de despesas — uma cama segura para imprevistos',
    emoji: '🛡️',
    tint: '#0F766E',
    alvo: 15000,
    atual: 6800,
    contribuicao: 600,
    criadaEm: '01/2025',
    alvoData: '12/2026',
    cor: 'verde',
    prioridade: 1,
  },
  {
    id: 'maceio',
    nome: 'Apartamento em Maceió',
    descricao: 'Entrada de 20% num 2 quartos perto da praia',
    emoji: '🏖️',
    tint: '#06B6D4',
    alvo: 80000,
    atual: 12500,
    contribuicao: 1500,
    criadaEm: '03/2024',
    alvoData: '12/2030',
    cor: 'azul',
    prioridade: 2,
  },
  {
    id: 'notebook',
    nome: 'Notebook novo',
    descricao: 'MacBook Pro 14" para o trabalho',
    emoji: '💻',
    tint: '#7C3AED',
    alvo: 8000,
    atual: 5200,
    contribuicao: 400,
    criadaEm: '11/2025',
    alvoData: '11/2026',
    cor: 'roxo',
    prioridade: 3,
  },
  {
    id: 'pos',
    nome: 'Pós-graduação',
    descricao: 'Especialização em Direito Digital',
    emoji: '🎓',
    tint: '#F59E0B',
    alvo: 24000,
    atual: 2400,
    contribuicao: 300,
    criadaEm: '02/2026',
    alvoData: '02/2032',
    cor: 'amarelo',
    prioridade: 4,
  },
];

const METAS_ATINGIDAS = [
  { nome: 'Viagem São Paulo', emoji: '✈️', valor: 3200, mesAtingido: '03/2025' },
  { nome: 'Curso de inglês',  emoji: '🇬🇧', valor: 2400, mesAtingido: '11/2024' },
];

// ─── Icons (Lucide-style, stroke 1.6, currentColor) ───────────
const __ico = (path) => ({ size = 18, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{path}</svg>
);
const Icon = {
  Home:      __ico(<><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2v-9z"/></>),
  Receipt:   __ico(<><path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-1.5V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></>),
  Pie:       __ico(<><circle cx="12" cy="12" r="9"/><path d="M12 3v9l8 4"/></>),
  Wallet:    __ico(<><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 14h2"/></>),
  Goal:      __ico(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></>),
  Users:     __ico(<><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 11a3 3 0 100-6M21.5 20a5.5 5.5 0 00-4-5.3"/></>),
  Plus:      __ico(<><path d="M12 5v14M5 12h14"/></>),
  User:      __ico(<><circle cx="12" cy="8" r="3.6"/><path d="M4 21a8 8 0 0116 0"/></>),
  Search:    __ico(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>),
  Bell:      __ico(<><path d="M6 8a6 6 0 1112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5zM10 19a2 2 0 004 0"/></>),
  Settings:  __ico(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  Filter:    __ico(<><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/></>),
  Calendar:  __ico(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>),
  Down:      __ico(<><path d="M6 9l6 6 6-6"/></>),
  Up:        __ico(<><path d="M6 15l6-6 6 6"/></>),
  Right:     __ico(<><path d="M9 6l6 6-6 6"/></>),
  Left:      __ico(<><path d="M15 6l-6 6 6 6"/></>),
  X:         __ico(<><path d="M5 5l14 14M19 5L5 19"/></>),
  Check:     __ico(<><path d="M4 12l5 5L20 6"/></>),
  Eye:       __ico(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  EyeOff:    __ico(<><path d="M3 3l18 18M10.6 6.2A10 10 0 0112 6c6.5 0 10 7 10 7a17 17 0 01-3.4 4M6.6 6.6A17 17 0 002 12s3 6.5 9.4 6.9M9.9 9.9a3 3 0 004.2 4.2"/></>),
  TrendUp:   __ico(<><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></>),
  TrendDown: __ico(<><path d="M3 7l6 6 4-4 8 8M14 17h7v-7"/></>),
  Sparkles:  __ico(<><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/></>),
  Arrow:     __ico(<><path d="M5 12h14M13 6l6 6-6 6"/></>),
  ArrowUp:   __ico(<><path d="M12 19V5M5 12l7-7 7 7"/></>),
  ArrowDown: __ico(<><path d="M12 5v14M5 12l7 7 7-7"/></>),
  Dots:      __ico(<><circle cx="12" cy="6" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18" r="1.3" fill="currentColor"/></>),
  Import:    __ico(<><path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></>),
  Export:    __ico(<><path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></>),
  Clock:     __ico(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  Card:      __ico(<><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/></>),
  Bank:      __ico(<><path d="M3 9l9-5 9 5v2H3V9zM5 11v7M9 11v7M15 11v7M19 11v7M3 21h18"/></>),
  Tag:       __ico(<><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/></>),
  Refresh:   __ico(<><path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5"/></>),
  Menu:      __ico(<><path d="M4 6h16M4 12h16M4 18h16"/></>),
  Wifi:      __ico(<><path d="M5 12.55a11 11 0 0114 0M8.5 16a6.5 6.5 0 017 0M12 20l.01 0"/></>),
};

Object.assign(window, {
  fmtBRL, fmtPct, splitBRL,
  USER, ACCOUNTS, CARDS, CATEGORIES, TRANSACTIONS,
  MONTHLY, SPEND_BY_CATEGORY, BUDGET_GROUPS, EMOJI_PALETTE,
  METAS, METAS_ATINGIDAS,
  txMonth, ymOf, mesFaturaFor, isCardId,
  Icon,
});
