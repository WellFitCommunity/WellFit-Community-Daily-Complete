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
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const supabaseClient_1 = require("../lib/supabaseClient");
const DemographicsPage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [formData, setFormData] = (0, react_1.useState)({
        full_name: '',
        phone: '',
        pin: '',
        dob: '',
        address: '',
        hasEmail: false,
    });
    const [error, setError] = (0, react_1.useState)(null);
    const [success, setSuccess] = (0, react_1.useState)(false);
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const { full_name, phone, pin, dob, address, hasEmail } = formData;
        // Save email preference to localStorage
        localStorage.setItem('prefersEmail', hasEmail ? 'true' : 'false');
        // Save phone & PIN locally (for fallback use)
        localStorage.setItem('wellfitPhone', phone);
        localStorage.setItem('wellfitPin', pin);
        // Get Supabase user ID if email is being used
        const { data: { user }, error: sessionError, } = await supabaseClient_1.supabase.auth.getUser();
        const userId = user?.id ?? crypto.randomUUID();
        localStorage.setItem('wellfitUserId', userId);
        localStorage.setItem('wellfitName', full_name);
        // Save to profiles table
        const { error: profileError } = await supabaseClient_1.supabase.from('profiles').upsert({
            id: userId,
            full_name,
            phone,
            dob,
            address,
        });
        // Save to phone_auth table (for local login)
        const { error: phoneAuthError } = await supabaseClient_1.supabase.from('phone_auth').upsert({
            id: userId,
            phone,
            pin,
        });
        if (profileError || phoneAuthError) {
            setError(profileError?.message || phoneAuthError?.message || 'Unknown error.');
        }
        else {
            setSuccess(true);
            setError(null);
            hasEmail ? navigate('/supabase-login') : navigate('/dashboard');
        }
    };
    return (<div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-center text-wellfit-blue">Tell Us About You</h2>
      <p className="text-gray-600 text-center">We’ll use this to personalize your WellFit experience.</p>

      {error && <p className="text-red-500 text-center">{error}</p>}
      {success && <p className="text-green-600 text-center">Profile saved!</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="full_name" placeholder="Full Name" value={formData.full_name} onChange={handleChange} className="w-full p-2 border rounded"/>
        <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded"/>
        <input name="pin" placeholder="4-Digit PIN" maxLength={4} value={formData.pin} onChange={handleChange} className="w-full p-2 border rounded"/>
        <input name="dob" type="date" placeholder="Date of Birth" value={formData.dob} onChange={handleChange} className="w-full p-2 border rounded"/>
        <input name="address" placeholder="Address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded"/>

        <div className="flex items-center space-x-2">
          <input type="checkbox" id="hasEmail" name="hasEmail" checked={formData.hasEmail} onChange={handleChange}/>
          <label htmlFor="hasEmail" className="text-sm text-gray-700">
            I have an email address and I am willing to use it to log in for security purposes.
          </label>
        </div>

        <button type="submit" className="w-full py-2 bg-wellfit-green text-white rounded hover:bg-green-700">
          Submit
        </button>
      </form>
    </div>);
};
exports.default = DemographicsPage;
