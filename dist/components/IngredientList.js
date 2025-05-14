"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/IngredientList.tsx
const react_1 = __importDefault(require("react"));
const IngredientList = ({ ingredients }) => {
    return (<ul className="list-disc ml-6 mt-2 space-y-1">
      {ingredients.map((item, index) => (<li key={index} className="text-base text-gray-800">{item}</li>))}
    </ul>);
};
exports.default = IngredientList;
