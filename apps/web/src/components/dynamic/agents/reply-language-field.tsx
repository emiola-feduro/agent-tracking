import { REPLY_LANGUAGE_INFO, REPLY_LANGUAGES, type ReplyLanguage } from "@agent-tracking/core";
import SelectField from "@/components/ui/select-field/select-field";

const NONE = "none";
const OPTIONS = [...REPLY_LANGUAGES.map((l) => ({ value: l, label: REPLY_LANGUAGE_INFO[l].label })), { value: NONE, label: "Sin indicar" }];

type ReplyLanguageFieldProps = { value: ReplyLanguage | null; onChange: (value: ReplyLanguage | null) => void };

/** The language agents use with the person: answers, summaries at the end of each task and reports. */
const ReplyLanguageField = ({ value, onChange }: ReplyLanguageFieldProps) => (
  <div className="flex max-w-sm flex-col gap-1">
    <SelectField
      label="Idioma de las respuestas y resúmenes"
      value={value ?? NONE}
      onChange={(v) => onChange(v === NONE ? null : (v as ReplyLanguage))}
      options={OPTIONS}
    />
    <p className="text-sm text-muted">
      {value ? "Los agentes te responden y resumen su trabajo en este idioma. El código sigue las convenciones del proyecto." : "Cada agente usa el idioma que prefiera."}
    </p>
  </div>
);

export default ReplyLanguageField;
