"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/Header.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const lucide_react_1 = require("lucide-react");
const Header = () => {
    const [menuOpen, setMenuOpen] = (0, react_1.useState)(false);
    return (<header className="bg-gradient-to-r from-wellfit-blue to-wellfit-green shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Title */} 
          <div className="text-white text-xl font-bold">WellFit Community</div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6">
            <react_router_dom_1.Link to="/dashboard" className="text-white hover:text-[#8cc63f] transition">
              Dashboard
            </react_router_dom_1.Link>
            <react_router_dom_1.Link to="/wordfind" className="text-white hover:text-[#8cc63f] transition">
              Word Find
            </react_router_dom_1.Link>
            <react_router_dom_1.Link to="/logout" className="text-red-300 hover:text-red-500 transition">
              Log Out
            </react_router_dom_1.Link>
            <a href="https://www.theWellFitCommunity.org" target="_blank" rel="noopener noreferrer" className="text-white bg-[#8cc63f] px-3 py-1 rounded hover:bg-green-700 transition">
              Visit Website
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button onClick={() => setMenuOpen(open => !open)} className="md:hidden text-white focus:outline-none" aria-label="Toggle menu">
            {menuOpen ? <lucide_react_1.X size={24}/> : <lucide_react_1.Menu size={24}/>}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (<nav className="md:hidden px-4 pb-4 space-y-2">
          <react_router_dom_1.Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block text-white hover:text-[#8cc63f] transition">
            Dashboard
          </react_router_dom_1.Link>
          <react_router_dom_1.Link to="/wordfind" onClick={() => setMenuOpen(false)} className="block text-white hover:text-[#8cc63f] transition">
            Word Find
          </react_router_dom_1.Link>
          <react_router_dom_1.Link to="/logout" onClick={() => setMenuOpen(false)} className="block text-red-300 hover:text-red-500 transition">
            Log Out
          </react_router_dom_1.Link>
          <a href="https://www.theWellFitCommunity.org" target="_blank" rel="noopener noreferrer" className="block text-white bg-[#8cc63f] px-3 py-2 rounded text-center hover:bg-green-700 transition">
            Visit Website
          </a>
        </nav>)}
    </header>);
};
exports.default = Header;
