export default function BottomNav({ active, onChange }) {
  const items = [
    { id: "home",    icon: "⌂",  label: "Home"    },
    { id: "trade",   icon: "◈",  label: "Trade"   },
    { id: "train",   icon: "▲",  label: "Train"   },
    { id: "learn",   icon: "◎",  label: "Learn"   },
    { id: "history", icon: "◷",  label: "History" },
    { id: "profile", icon: "◉",  label: "Profile" },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
