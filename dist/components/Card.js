"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Card = ({ className = '', children }) => (<section className={`bg-white rounded-2xl shadow-md p-6 mb-6 border-l-8 border-wellfit-green ${className}`}>
    {children}
  </section>);
exports.default = Card;
