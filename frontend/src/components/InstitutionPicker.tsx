import { useMemo, useState } from "react";
import { buttonClass, inputClass } from "./ui";

type Bi = { en: string; hi: string };

export interface Institution {
  id: string;
  name: string;
  name_hi: string;
  kind: string;
  category: string;
  checkable: boolean;
  aliases: string[];
}

// Which directory kinds fit each "who did they say they are" choice.
const KINDS: Record<string, string[]> = {
  bank: ["bank", "regulator"],
  police: ["agency", "police"],
  government: ["agency", "regulator", "police"],
  courier: ["courier"],
  telecom: ["telecom", "regulator"],
  company: ["bank", "courier", "telecom", "regulator", "agency", "police"],
};

const fold = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Searchable list of trusted organisations (English + Hindi names, abbreviations) plus "Other".
 *  `value` is a directory id, "other", or null (free text in `text`). */
export default function InstitutionPicker({
  items,
  type,
  value,
  text,
  onPick,
  onText,
  t,
}: {
  items: Institution[];
  type: string;
  value: string | null;
  text: string;
  onPick: (id: string | null) => void;
  onText: (s: string) => void;
  t: (b: Bi) => string;
}) {
  const [open, setOpen] = useState(false);
  const kinds = KINDS[type] ?? [];
  const chosen = items.find((i) => i.id === value);
  const matches = useMemo(() => {
    const q = fold(text);
    return items
      .filter((i) => kinds.includes(i.kind))
      .filter((i) => !q || [i.name, i.name_hi, ...i.aliases].some((s) => fold(s).includes(q)))
      .slice(0, 12);
  }, [items, kinds, text]);

  if (value === "other" || chosen) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-control bg-accent-tint px-4 py-3 text-base ring-2 ring-inset ring-accent">
        <span className="font-semibold">
          {value === "other" ? t({ en: "Other / not in the list", hi: "अन्य / सूची में नहीं" }) : `${chosen!.name} · ${chosen!.name_hi}`}
        </span>
        {chosen && !chosen.checkable && (
          <span className="text-sm text-ink-2">{t({ en: "can't be checked online", hi: "ऑनलाइन जाँच संभव नहीं" })}</span>
        )}
        <button className={`${buttonClass("secondary")} ml-auto`} onClick={() => { onPick(null); setOpen(true); }}>
          {t({ en: "Change", hi: "बदलें" })}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className={`${inputClass} ring-line`}
        aria-labelledby="inst-label"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={text}
        placeholder={t({ en: "Type to search: SBI, PSB, HDFC, CBI, India Post…", hi: "खोजें: एसबीआई, पंजाब नेशनल बैंक, सीबीआई…" })}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-card bg-surface p-1.5 text-base shadow-lift ring-1 ring-line">
          {matches.map((i) => (
            <li key={i.id}>
              <button
                className="flex w-full flex-wrap items-baseline gap-x-3 rounded-[8px] px-3 py-2.5 text-left hover:bg-subtle focus:bg-subtle focus:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(i.id); setOpen(false); }}
              >
                <span className="font-semibold">{i.name}</span>
                <span className="text-sm text-ink-2">{i.name_hi}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-ink-2">{t({ en: "Not in our list", hi: "हमारी सूची में नहीं" })}</li>
          )}
          <li className="mt-1 border-t border-line pt-1">
            <button
              className="w-full rounded-[8px] px-3 py-2.5 text-left font-semibold text-accent hover:bg-subtle focus:bg-subtle focus:outline-none"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick("other"); setOpen(false); }}
            >
              {t({ en: "Other / not in the list", hi: "अन्य / सूची में नहीं" })}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
