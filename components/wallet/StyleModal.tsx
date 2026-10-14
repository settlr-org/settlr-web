"use client";
import { FormEvent, useState } from "react";
import { Modal } from "../UI";
import { suggestColour } from "../../lib/wallet";
import { errorText, walletWrite } from "./data";
import { ColourPicker, IconPicker } from "./Pickers";

/** Rename, recolour and re-icon a category or tag. */
export function StyleModal({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: "category" | "tag";
  item: { id: string; name: string; color?: string; icon?: string };
  onClose: () => void;
  onSaved: (name: string) => void | Promise<void>;
}) {
  const [color, setColor] = useState(item.color || suggestColour(0));
  const [icon, setIcon] = useState(item.icon || "tag");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(
      new FormData(event.currentTarget).get("name") || "",
    ).trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    try {
      await walletWrite(
        `/api/v1/${kind === "tag" ? "tags" : "categories"}/${item.id}`,
        "PATCH",
        { name, color, icon },
      );
      await onSaved(name);
    } catch (cause) {
      setError(errorText(cause, `Could not save the ${kind}.`));
    }
  };
  return (
    <Modal
      title={`Edit ${kind}`}
      subtitle="Changes apply everywhere it is used."
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label>
          Name
          <input
            name="name"
            defaultValue={item.name}
            maxLength={kind === "tag" ? 50 : 100}
            required
            data-autofocus
          />
        </label>
        <ColourPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full">Save</button>
      </form>
    </Modal>
  );
}
