"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/StepList.tsx
const react_1 = __importDefault(require("react"));
const StepList = ({ steps }) => {
    return (<ol className="list-decimal ml-6 mt-2 space-y-2">
      {steps.map((step, index) => (<li key={index} className="text-base text-gray-800">{step}</li>))}
    </ol>);
};
exports.default = StepList;
