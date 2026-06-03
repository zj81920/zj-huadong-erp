"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  User,
  KeyRound,
  PenLine,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Upload,
  X,
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ActiveTab = "profile" | "change-password" | "signature";

export default function ProfileSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam === "change-password" ? "change-password"
    : tabParam === "signature" ? "signature"
    : "profile"
  );

  const [realName, setRealName] = useState(user?.realName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [signaturePreview, setSignaturePreview] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [signatureUploading, setSignatureUploading] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setRealName(user.realName || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatarUrl || "");
      setAvatarPreview(user.avatarUrl || "");
    }
    fetch("/api/auth/current-user")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.signatureUrl) {
          setSignaturePreview(json.data.signatureUrl);
        }
      })
      .catch(() => {});
  }, [user]);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setProfileSuccess(false);
    setPasswordSuccess(false);
    const params = new URLSearchParams();
    if (tab === "change-password") params.set("tab", "change-password");
    else if (tab === "signature") params.set("tab", "signature");
    const qs = params.toString();
    router.replace(`/settings/profile${qs ? `?${qs}` : ""}`);
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess(false);
    if (!realName.trim()) { setProfileError("真实姓名不能为空"); return; }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realName: realName.trim(), phone: phone.trim() || null, email: email.trim() || null, avatarUrl: avatarUrl || null }),
      });
      const json = await res.json();
      if (res.ok) { setProfileSuccess(true); await refresh(); }
      else { setProfileError(json.error || "保存失败"); }
    } catch { setProfileError("网络错误，请重试"); }
    finally { setProfileSaving(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(png|jpe?g)/)) { setProfileError("仅支持 png、jpg、jpeg 格式"); return; }
    setProfileError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) { setAvatarUrl(json.url); setAvatarPreview(json.url); }
      else { setProfileError(json.error || "上传失败"); }
    } catch { setProfileError("上传失败"); }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (!currentPassword) { setPasswordError("请输入当前密码"); return; }
    if (!newPassword) { setPasswordError("请输入新密码"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("两次输入的密码不一致"); return; }
    if (newPassword.length < 6) { setPasswordError("新密码长度不能少于6位"); return; }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok) { setPasswordSuccess(true); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
      else { setPasswordError(json.error || "修改失败"); }
    } catch { setPasswordError("网络错误"); }
    finally { setPasswordSaving(false); }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(png|jpe?g)/)) { setSignatureError("仅支持 png、jpg、jpeg 格式"); return; }
    setSignatureError("");
    setSignatureUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        const saveRes = await fetch("/api/settings/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureUrl: json.url }),
        });
        if (saveRes.ok) { setSignaturePreview(json.url); }
        else { setSignatureError("保存签名失败"); }
      } else { setSignatureError(json.error || "上传失败"); }
    } catch { setSignatureError("上传失败"); }
    finally { setSignatureUploading(false); if (signatureInputRef.current) signatureInputRef.current.value = ""; }
  };

  const handleRemoveSignature = async () => {
    try {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureUrl: null }),
      });
      setSignaturePreview("");
    } catch {}
  };

  const tabs = [
    { key: "profile" as const, label: "基本资料", icon: User },
    { key: "change-password" as const, label: "修改密码", icon: KeyRound },
    { key: "signature" as const, label: "手写签名", icon: PenLine },
  ];

  return (
    <>
      <div className="page-header">
        <h1>个人设置</h1>
        <p>管理您的账户信息、密码和签名</p>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <div className="bento-card-static p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === tab.key ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 max-w-2xl">
          {activeTab === "profile" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">基本资料</h3>
              <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-100">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="头像" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm hover:bg-blue-600 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <input ref={avatarInputRef} type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <div className="text-[14px] font-medium text-gray-900">个人头像</div>
                  <div className="text-[12px] text-gray-500 mt-1">支持 JPG/PNG 格式，建议 200x200px</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">登录账号</label>
                  <input type="text" className="ios-input bg-gray-50 text-gray-500 cursor-not-allowed" value={user?.username || ""} disabled />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">真实姓名 <span className="text-red-400">*</span></label>
                  <input type="text" className="ios-input" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="请输入真实姓名" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">手机号</label>
                  <input type="text" className="ios-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">邮箱</label>
                  <input type="email" className="ios-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" />
                </div>
              </div>
              {profileError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-[13px] text-green-600 bg-green-50 rounded-xl px-4 py-2.5 mb-4">
                  <Check className="w-4 h-4 shrink-0" />保存成功
                </div>
              )}
              <button onClick={handleSaveProfile} disabled={profileSaving} className="ios-btn ios-btn-primary gap-1.5">
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}保存修改
              </button>
            </div>
          )}

          {activeTab === "change-password" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">修改密码</h3>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">当前密码</label>
                  <div className="relative">
                    <input type={showCurrentPwd ? "text" : "password"} className="ios-input pr-10" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="请输入当前密码" />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">新密码</label>
                  <div className="relative">
                    <input type={showNewPwd ? "text" : "password"} className="ios-input pr-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="请输入新密码（至少6位）" />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">确认新密码</label>
                  <input type="password" className="ios-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="请再次输入新密码" onKeyDown={(e) => e.key === "Enter" && handleChangePassword()} />
                </div>
              </div>
              {passwordError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-[13px] text-green-600 bg-green-50 rounded-xl px-4 py-2.5 mt-4">
                  <Check className="w-4 h-4 shrink-0" />密码修改成功
                </div>
              )}
              <button onClick={handleChangePassword} disabled={passwordSaving} className="ios-btn ios-btn-primary gap-1.5 mt-4">
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}确认修改
              </button>
            </div>
          )}

          {activeTab === "signature" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">手写签名</h3>
              <p className="text-[13px] text-gray-500 mb-6">上传您的电子签名，用于审批流程中的签字确认。建议使用透明背景的 PNG 图片。</p>
              <input ref={signatureInputRef} type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={handleSignatureUpload} />
              {signaturePreview ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <img src={signaturePreview} alt="电子签名预览" className="max-h-[100px] max-w-full object-contain" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" className="ios-btn ios-btn-secondary ios-btn-sm" onClick={() => signatureInputRef.current?.click()} disabled={signatureUploading}>
                      <Upload className="w-3.5 h-3.5" />重新上传
                    </button>
                    <button type="button" className="ios-btn ios-btn-ghost ios-btn-sm text-red-500!" onClick={handleRemoveSignature}>
                      <X className="w-3.5 h-3.5" />移除签名
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="w-full py-10 rounded-xl border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 flex flex-col items-center gap-2 cursor-pointer" onClick={() => signatureInputRef.current?.click()} disabled={signatureUploading}>
                  {signatureUploading ? (
                    <><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /><span className="text-[13px] text-gray-500">上传中...</span></>
                  ) : (
                    <><Upload className="w-6 h-6 text-gray-400" /><span className="text-[13px] text-gray-500">点击上传电子签名</span><span className="text-[11px] text-gray-400">支持 PNG、JPG，建议透明背景</span></>
                  )}
                </button>
              )}
              {signatureError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{signatureError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
