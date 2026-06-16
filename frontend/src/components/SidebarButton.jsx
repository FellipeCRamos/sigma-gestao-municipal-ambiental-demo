export default function SidebarButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: active ? "var(--admin-nav-active-border, #111827)" : "var(--admin-nav-border, #e5e7eb)",
        background: active ? "var(--admin-nav-active-bg, #111827)" : "var(--admin-nav-bg, #ffffff)",
        color: active ? "var(--admin-nav-active-color, #ffffff)" : "var(--admin-nav-color, #111827)",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 700,
        boxShadow: active ? "var(--admin-nav-active-shadow, none)" : "none",
        transition: "0.2s ease",
      }}
    >
      {label}
    </button>
  );
}
