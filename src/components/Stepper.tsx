"use client";

import React from "react";
import { Check } from "lucide-react";

interface StepperProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, label: "Create Sheet" },
  { number: 2, label: "Hide Tabs" },
  { number: 3, label: "Share" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="stepper-bar">
      <div className="stepper-wrap">
        {STEPS.map((step, idx) => {
          const isDone = step.number < currentStep;
          const isActive = step.number === currentStep;

          let badgeClass = "stepper-badge ";
          let labelClass = "stepper-label ";

          if (isDone) {
            badgeClass += "stepper-badge--done";
            labelClass += "stepper-label--done";
          } else if (isActive) {
            badgeClass += "stepper-badge--active";
            labelClass += "stepper-label--active";
          } else {
            badgeClass += "stepper-badge--upcoming";
            labelClass += "stepper-label--upcoming";
          }

          return (
            <React.Fragment key={step.number}>
              <div className="stepper-item">
                <div className={badgeClass}>
                  {isDone ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </div>
                <span className={labelClass}>{step.label}</span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className={[
                    "stepper-line",
                    step.number < currentStep
                      ? "stepper-line--done"
                      : "stepper-line--upcoming",
                  ].join(" ")}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
