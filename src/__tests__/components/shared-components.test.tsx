import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "@/components/admin/shared/DataTable";
import { StatusBadgeBar, type StatusBadge } from "@/components/admin/shared/StatusBadgeBar";
import { SummaryCards, type SummaryCardItem } from "@/components/admin/shared/SummaryCard";
import { CrudHeader } from "@/components/admin/shared/CrudHeader";
import { EmptyState } from "@/components/admin/shared/EmptyState";
import { DeleteConfirmButton } from "@/components/admin/shared/DeleteConfirmButton";
import { EditButton } from "@/components/admin/shared/EditButton";
import { FormField } from "@/components/admin/shared/FormField";
import { FormSelect } from "@/components/admin/shared/FormSelect";
import { AdminFormCard } from "@/components/admin/shared/AdminFormCard";
import { Users, CreditCard } from "lucide-react";

// ─── DataTable ──────────────────────────────────────────────────
describe("DataTable", () => {
  const testData = [
    { id: "1", name: "Alice", role: "Admin" },
    { id: "2", name: "Bob", role: "Staff" },
  ];

  const columns: DataTableColumn<{ id: string; name: string; role: string }>[] = [
    { header: "Name", cell: (item) => item.name },
    { header: "Role", cell: (item) => item.role },
  ];

  it("renders table with headers and data", () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders empty content when data is empty", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyContent={<p>Aucune donnée</p>}
      />
    );

    expect(screen.getByText("Aucune donnée")).toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
  });

  it("uses custom keyExtractor", () => {
    const dataWithCustomKey = [{ identifier: "a", name: "Test", role: "X" }];
    const { container } = render(
      <DataTable
        columns={columns}
        data={dataWithCustomKey as any}
        keyExtractor={(item) => (item as any).identifier}
      />
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
  });
});

// ─── StatusBadgeBar ─────────────────────────────────────────────
describe("StatusBadgeBar", () => {
  it("renders badges with counts and labels", () => {
    const badges: StatusBadge[] = [
      { count: 5, label: "Actifs", color: "green" },
      { count: 2, label: "Inactifs", color: "red" },
    ];

    render(<StatusBadgeBar badges={badges} />);

    expect(screen.getByText("5 Actifs")).toBeInTheDocument();
    expect(screen.getByText("2 Inactifs")).toBeInTheDocument();
  });

  it("renders all supported colors", () => {
    const badges: StatusBadge[] = [
      { count: 1, label: "Green", color: "green" },
      { count: 2, label: "Red", color: "red" },
      { count: 3, label: "Amber", color: "amber" },
      { count: 4, label: "Blue", color: "blue" },
      { count: 5, label: "Gray", color: "gray" },
    ];

    render(<StatusBadgeBar badges={badges} />);

    expect(screen.getByText("1 Green")).toBeInTheDocument();
    expect(screen.getByText("5 Gray")).toBeInTheDocument();
  });
});

// ─── SummaryCards ───────────────────────────────────────────────
describe("SummaryCards", () => {
  it("renders cards with labels and values", () => {
    const items: SummaryCardItem[] = [
      { label: "Total", value: "1,000 GNF" },
      { label: "Payé", value: "800 GNF", valueColor: "text-green-600" },
    ];

    render(<SummaryCards items={items} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("1,000 GNF")).toBeInTheDocument();
    expect(screen.getByText("Payé")).toBeInTheDocument();
    expect(screen.getByText("800 GNF")).toBeInTheDocument();
  });

  it("renders with different column counts", () => {
    const items: SummaryCardItem[] = [
      { label: "A", value: "1" },
      { label: "B", value: "2" },
    ];

    const { container } = render(<SummaryCards items={items} columns={2} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-2");
  });
});

// ─── CrudHeader ─────────────────────────────────────────────────
describe("CrudHeader", () => {
  it("renders badges and add button", () => {
    const onAdd = vi.fn();
    render(
      <CrudHeader
        badges={[{ count: 3, label: "Actifs", color: "green" }]}
        addLabel="Ajouter"
        onAdd={onAdd}
      />
    );

    expect(screen.getByText("3 Actifs")).toBeInTheDocument();
    expect(screen.getByText("Ajouter")).toBeInTheDocument();
  });

  it("calls onAdd when button is clicked", () => {
    const onAdd = vi.fn();
    render(<CrudHeader addLabel="Ajouter" onAdd={onAdd} />);

    fireEvent.click(screen.getByText("Ajouter"));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders leftContent when provided instead of badges", () => {
    render(
      <CrudHeader
        leftContent={<span>Custom content</span>}
        addLabel="Ajouter"
        onAdd={vi.fn()}
      />
    );

    expect(screen.getByText("Custom content")).toBeInTheDocument();
  });
});

// ─── EmptyState ─────────────────────────────────────────────────
describe("EmptyState", () => {
  it("renders icon and message", () => {
    render(<EmptyState icon={CreditCard} message="Aucun paiement" />);

    expect(screen.getByText("Aucun paiement")).toBeInTheDocument();
  });
});

// ─── DeleteConfirmButton ────────────────────────────────────────
describe("DeleteConfirmButton", () => {
  it("shows trash icon by default", () => {
    render(
      <DeleteConfirmButton
        confirming={false}
        onConfirm={vi.fn()}
        onRequestConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Trash icon button should exist with title "Supprimer"
    const button = screen.getByTitle("Supprimer");
    expect(button).toBeInTheDocument();
  });

  it("shows Oui/Non buttons when confirming", () => {
    render(
      <DeleteConfirmButton
        confirming={true}
        onConfirm={vi.fn()}
        onRequestConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Oui")).toBeInTheDocument();
    expect(screen.getByText("Non")).toBeInTheDocument();
  });

  it("calls onConfirm when Oui is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmButton
        confirming={true}
        onConfirm={onConfirm}
        onRequestConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Oui"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Non is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmButton
        confirming={true}
        onConfirm={vi.fn()}
        onRequestConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Non"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onRequestConfirm when trash icon is clicked", () => {
    const onRequestConfirm = vi.fn();
    render(
      <DeleteConfirmButton
        confirming={false}
        onConfirm={vi.fn()}
        onRequestConfirm={onRequestConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle("Supprimer"));
    expect(onRequestConfirm).toHaveBeenCalledOnce();
  });
});

// ─── EditButton ─────────────────────────────────────────────────
describe("EditButton", () => {
  it("renders with default title", () => {
    render(<EditButton onClick={vi.fn()} />);
    expect(screen.getByTitle("Modifier")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    render(<EditButton onClick={vi.fn()} title="Éditer" />);
    expect(screen.getByTitle("Éditer")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<EditButton onClick={onClick} />);

    fireEvent.click(screen.getByTitle("Modifier"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

// ─── FormField ──────────────────────────────────────────────────
describe("FormField", () => {
  it("renders label and input", () => {
    render(<FormField label="Nom" value="Test" onChange={vi.fn()} />);

    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test")).toBeInTheDocument();
  });

  it("shows required asterisk when required", () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} required />);

    expect(screen.getByText("Email *")).toBeInTheDocument();
  });

  it("calls onChange when input value changes", () => {
    const onChange = vi.fn();
    render(<FormField label="Nom" value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } });
    expect(onChange).toHaveBeenCalledWith("Alice");
  });
});

// ─── FormSelect ─────────────────────────────────────────────────
describe("FormSelect", () => {
  const options = [
    { value: "active", label: "Actif" },
    { value: "inactive", label: "Inactif" },
  ];

  it("renders label and select options", () => {
    render(<FormSelect label="Statut" value="active" onChange={vi.fn()} options={options} />);

    expect(screen.getByText("Statut")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Actif")).toBeInTheDocument();
  });

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    render(<FormSelect label="Statut" value="active" onChange={onChange} options={options} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "inactive" } });
    expect(onChange).toHaveBeenCalledWith("inactive");
  });
});

// ─── AdminFormCard ──────────────────────────────────────────────
describe("AdminFormCard", () => {
  it("renders add title when not editing", () => {
    render(
      <AdminFormCard
        show={true}
        editing={false}
        addTitle="Ajouter un livreur"
        editTitle="Modifier le livreur"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <FormField label="Nom" value="" onChange={vi.fn()} />
      </AdminFormCard>
    );

    expect(screen.getByText("Ajouter un livreur")).toBeInTheDocument();
    expect(screen.getByText("Ajouter")).toBeInTheDocument();
  });

  it("renders edit title when editing", () => {
    render(
      <AdminFormCard
        show={true}
        editing={true}
        addTitle="Ajouter un livreur"
        editTitle="Modifier le livreur"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <FormField label="Nom" value="" onChange={vi.fn()} />
      </AdminFormCard>
    );

    expect(screen.getByText("Modifier le livreur")).toBeInTheDocument();
    expect(screen.getByText("Enregistrer")).toBeInTheDocument();
  });

  it("does not render when show is false", () => {
    render(
      <AdminFormCard
        show={false}
        editing={false}
        addTitle="Ajouter"
        editTitle="Modifier"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <p>Content</p>
      </AdminFormCard>
    );

    expect(screen.queryByText("Ajouter")).not.toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AdminFormCard
        show={true}
        editing={false}
        addTitle="Formulaire"
        editTitle="Modifier"
        onSave={onSave}
        onCancel={vi.fn()}
      >
        <p>Content</p>
      </AdminFormCard>
    );

    // The save button says "Ajouter" when not editing — find it by role
    const saveButton = screen.getAllByText("Ajouter").find(el => el.closest("button"));
    fireEvent.click(saveButton!);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <AdminFormCard
        show={true}
        editing={false}
        addTitle="Ajouter"
        editTitle="Modifier"
        onSave={vi.fn()}
        onCancel={onCancel}
      >
        <p>Content</p>
      </AdminFormCard>
    );

    fireEvent.click(screen.getByText("Annuler"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
