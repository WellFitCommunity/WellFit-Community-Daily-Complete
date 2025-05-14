"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Footer = () => {
    return (<footer className="bg-[#003865] text-white text-center p-2 mt-6 rounded-t-xl">
      <p className="text-sm">&copy; {new Date().getFullYear()} WellFit Community. All rights reserved.</p>
    </footer>);
};
exports.default = Footer;
