import { Button } from "../../components/ui/Button";
import { Stepper } from "../../components/common/Stepper";

const defaultSteps = [
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Warden", value: "warden_approved" },
];

export function ReportActionPanel({
  status = "draft",
  onGenerate,
  onSubmit,
  generating,
  submitting,
  steps = defaultSteps,
}) {
  return (
    <div className="space-y-6">
      <Stepper steps={steps} current={status} />
      <div className="panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="section-title">Report workflow</h3>
          <p className="mt-2 text-sm text-slate-500">
            Generate a fresh report snapshot, then submit it into the approval chain.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onGenerate} loading={generating}>
            Generate report
          </Button>
          <Button onClick={onSubmit} loading={submitting} disabled={status !== "draft"}>
            Submit report
          </Button>
        </div>
      </div>
    </div>
  );
}
