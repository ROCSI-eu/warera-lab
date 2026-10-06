import type { PublicCompanySnapshot } from "@warera-lab/domain";

import type { CompanyPresentation } from "./company-display.js";

export function CompanyButton({
  company,
  presentation,
  selected,
  onSelect,
  disabled,
}: {
  company: PublicCompanySnapshot;
  presentation: CompanyPresentation;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      className={"company-card" + (selected ? " company-card--selected" : "")}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="company-card__heading">
        <strong>{company.name}</strong>
        {presentation.fallbackId ? (
          <small className="company-card__id">ID {presentation.fallbackId}</small>
        ) : presentation.compactFallbackId ? (
          <small className="company-card__id company-card__id--compact">
            ID {presentation.compactFallbackId}
          </small>
        ) : null}
      </span>
      <span className="company-card__context">
        {company.itemCode} · {presentation.location}
      </span>
      <span className="company-card__operations">{presentation.operations}</span>
      <small className="company-card__upgrades">{presentation.upgrades}</small>
    </button>
  );
}

export function CompanySelector({
  companies,
  presentations,
  selectedCompanyId,
  onSelect,
  disabled,
}: {
  companies: PublicCompanySnapshot[];
  presentations: Map<string, CompanyPresentation>;
  selectedCompanyId: string | undefined;
  onSelect: (company: PublicCompanySnapshot) => void;
  disabled?: boolean | undefined;
}) {
  if (companies.length === 0) {
    return <p className="muted">No public company records were returned for this player.</p>;
  }

  return (
    <div className="company-list">
      {companies.map((company) => (
        <CompanyButton
          key={company.id}
          company={company}
          presentation={presentations.get(company.id)!}
          selected={company.id === selectedCompanyId}
          onSelect={() => onSelect(company)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
