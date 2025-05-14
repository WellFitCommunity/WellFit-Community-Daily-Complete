"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/App.tsx
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
const Header_1 = __importDefault(require("./components/Header"));
const Footer_1 = __importDefault(require("./components/Footer"));
const WelcomePage_1 = __importDefault(require("./components/WelcomePage"));
const SeniorEnrollmentPage_1 = __importDefault(require("./components/SeniorEnrollmentPage"));
const Dashboard_1 = __importDefault(require("./components/Dashboard"));
const CheckInTracker_1 = __importDefault(require("./components/CheckInTracker"));
const WordFind_1 = __importDefault(require("./components/WordFind"));
const MealDetailPage_1 = __importDefault(require("./pages/MealDetailPage"));
const LogoutPage_1 = __importDefault(require("./components/LogoutPage"));
const RequireAuth_1 = __importDefault(require("./components/RequireAuth"));
const AdminPanel_1 = __importDefault(require("./components/AdminPanel"));
const AdminProfileEditor_1 = __importDefault(require("./components/AdminProfileEditor"));
const Layout = ({ children }) => {
    const location = (0, react_router_dom_1.useLocation)();
    const showHeaderFooter = location.pathname !== '/';
    return (<div className="min-h-screen flex flex-col bg-gradient-to-r from-wellfit-blue to-wellfit-green text-white">
      {showHeaderFooter && <Header_1.default />}
      <main className="flex-grow p-4">{children}</main>
      {showHeaderFooter && <Footer_1.default />}
    </div>);
};
const App = () => (<Layout>
    <react_router_dom_1.Routes>
      {/* Public pages */}
      <react_router_dom_1.Route path="/" element={<WelcomePage_1.default />}/>
      <react_router_dom_1.Route path="/senior-enrollment" element={<SeniorEnrollmentPage_1.default />}/>
      <react_router_dom_1.Route path="/meal/:id" element={<MealDetailPage_1.default />}/>

      {/* Protected pages */}
      <react_router_dom_1.Route path="/dashboard" element={<RequireAuth_1.default>
            <Dashboard_1.default />
          </RequireAuth_1.default>}/>
      <react_router_dom_1.Route path="/checkin" element={<RequireAuth_1.default>
            <CheckInTracker_1.default />
          </RequireAuth_1.default>}/>
      <react_router_dom_1.Route path="/wordfind" element={<RequireAuth_1.default>
            <WordFind_1.default />
          </RequireAuth_1.default>}/>

      {/* Admin pages */}
      <react_router_dom_1.Route path="/admin-panel" element={<AdminPanel_1.default />}/>
      <react_router_dom_1.Route path="/admin-profile-editor" element={<AdminProfileEditor_1.default />}/>

      {/* Logout */}
      <react_router_dom_1.Route path="/logout" element={<LogoutPage_1.default />}/>

      {/* Fallback */}
      <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to="/" replace/>}/>
    </react_router_dom_1.Routes>
  </Layout>);
exports.default = App;
