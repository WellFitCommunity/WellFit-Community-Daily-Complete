"use strict";
// src/components/UsersList.tsx
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
const auth_helpers_react_1 = require("@supabase/auth-helpers-react");
const UsersList = () => {
    const supabase = (0, auth_helpers_react_1.useSupabaseClient)();
    const [profiles, setProfiles] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const fetchProfiles = async () => {
            const { data, error } = await supabase.from('profiles').select('*');
            if (error) {
                console.error('Error fetching profiles:', error.message);
            }
            else {
                setProfiles(data || []);
            }
            setLoading(false);
        };
        fetchProfiles();
    }, [supabase]);
    if (loading)
        return <p className="text-center text-gray-500">Loading users...</p>;
    return (<div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h3 className="text-xl font-bold text-wellfit-blue">Registered Users</h3>
      {profiles.length === 0 ? (<p className="text-center text-gray-400">No users found.</p>) : (<ul className="space-y-2">
          {profiles.map((user) => (<li key={user.id} className="bg-gray-100 rounded-lg p-3">
              <div className="font-semibold">{user.full_name}</div>
              <div className="text-sm text-gray-700">{user.phone}</div>
              {user.dob && <div className="text-sm text-gray-500">DOB: {user.dob}</div>}
              {user.address && <div className="text-sm text-gray-500">Address: {user.address}</div>}
            </li>))}
        </ul>)}
    </div>);
};
exports.default = UsersList;
