import * as React from "react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepChange,
  className,
}: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className="flex flex-col items-center flex-1"
              onClick={() => onStepChange?.(index)}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                  index < currentStep
                    ? "bg-green-500 text-white"
                    : index === currentStep
                    ? "bg-blue-500 text-white border-2 border-blue-600"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {index < currentStep ? "✓" : index + 1}
              </div>
              <p
                className={cn(
                  "text-xs font-semibold mt-2",
                  index === currentStep ? "text-gray-900" : "text-gray-600"
                )}
              >
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-gray-500 text-center mt-1">
                  {step.description}
                </p>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-1 flex-1 mx-2 mb-8 transition-all",
                  index < currentStep ? "bg-green-500" : "bg-gray-200"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
