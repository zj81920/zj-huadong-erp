"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  Check,
  X,
  Upload,
  Shield,
  Image,
  Camera,
  Power,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Role {
  id: string;
  name: string;
  description?: string;
  isProjectRole?: boolean;
}

interface UserItem {
  id: string;
  username: string;
  realName: string;
  phone?: string;
  email?: string;
  department?: string;
  signatureUrl?: string;
  avatarUrl?: string;
  isActive: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
}

interface UserFormData {
  username: string;
  realName: string;
  password: string;
  phone: string;
  email: string;
  department: string;
  roleIds: string[];
  signatureUrl: string;
  avatarUrl: string;
}

const emptyForm: UserFormData = {
  username: "",
  realName: "",
  password: "",
  phone: "",
  email: "",
  department: "",
  roleIds: [],
  signatureUrl: "",
  avatarUrl: "",
};

const ROLE_COLORS = [
  "ios-badge-blue",
  "ios-badge-green",
  "ios-badge-orange",
  "ios-badge-purple",
  "ios-badge-red",
];

function getRoleColor(index: number): string {
  return ROLE_COLORS[index % ROLE_COLORS.length];
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/settings/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setSignaturePreview("");
    setAvatarPreview("");
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: UserItem) => {
    setEditingItem(item);
    setForm({
      username: item.username,
      realName: item.realName,
      password: "",
      phone: item.phone || "",
      email: item.email || "",
      department: item.department || "",
      roleIds: item.roles.map((r) => r.id),
      signatureUrl: item.signatureUrl || "",
      avatarUrl: item.avatarUrl || "",
    });
    setSignaturePreview(item.signatureUrl || "");
    setAvatarPreview(item.avatarUrl || "");
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.username.trim()) {
      setFormError("登录账号不能为空");
      return;
    }
    if (!form.realName.trim()) {
      setFormError("用户名不能为空");
      return;
    }
    if (!editingItem && !form.password.trim()) {
      setFormError("新建用户必须设置密码");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        realName: form.realName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        department: form.department.trim() || null,
        roleIds: form.roleIds,
        signatureUrl: form.signatureUrl || null,
        avatarUrl: form.avatarUrl || null,
      };

      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      const url = editingItem
        ? `/api/settings/users/${editingItem.id}`
        : "/api/settings/users";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/users/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误，请重试");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (item: UserItem) => {
    try {
      const res = await fetch(`/api/settings/users/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      // ignore
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpe?g)/)) {
      setFormError("仅支持 png、jpg、jpeg 格式的图片");
      return;
    }

    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, signatureUrl: json.url }));
        setSignaturePreview(json.url);
      } else {
        setFormError(json.error || "上传失败");
      }
    } catch {
      setFormError("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveSignature = () => {
    setForm((prev) => ({ ...prev, signatureUrl: "" }));
    setSignaturePreview("");
  };

  // 头像上传处理
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpe?g)/)) {
      setFormError("仅支持 png、jpg、jpeg 格式的图片");
      return;
    }

    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, avatarUrl: json.url }));
        setAvatarPreview(json.url);
      } else {
        setFormError(json.error || "上传失败");
      }
    } catch {
      setFormError("上传失败，请重试");
    } finally {
      setUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarUrl: "" }));
    setAvatarPreview("");
  };

  const toggleRole = (roleId: string) => {
    setForm((prev) => {
      const exists = prev.roleIds.includes(roleId);
      return {
        ...prev,
        roleIds: exists
          ? prev.roleIds.filter((id) => id !== roleId)
          : [...prev.roleIds, roleId],
      };
    });
  };

  const updateForm = (field: keyof UserFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.realName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-[#1C1917]" />
            <div>
              <h1>用户设置</h1>
              <p>管理系统用户、分配角色、上传电子签名</p>
            </div>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增用户
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索登录账号、用户名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{filteredUsers.length}</span> 位用户
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search ? "没有匹配的用户" : "暂无用户，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>登录账号</th>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>电子签名</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.realName}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[13px] font-bold text-[#1C1917]">
                              {item.realName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="font-semibold">{item.username}</span>
                      </div>
                    </td>
                    <td>{item.realName}</td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.roles.length > 0 ? (
                          item.roles.map((role, idx) => (
                            <span
                              key={role.id}
                              className={`ios-badge ${getRoleColor(idx)}`}
                            >
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.signatureUrl ? (
                        <span className="ios-badge ios-badge-green">已上传</span>
                      ) : (
                        <span className="ios-badge ios-badge-gray">未上传</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`ios-badge cursor-pointer transition-all duration-150 ${
                          item.isActive ? "ios-badge-green" : "ios-badge-red"
                        }`}
                      >
                        <Power className="w-3 h-3 mr-1" />
                        {item.isActive ? "启用" : "停用"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        {item.username === "admin" ? (
                          <span className="ios-badge ios-badge-gray text-[11px]">系统管理员</span>
                        ) : (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={() => setDeleteConfirm(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {item.lastModifiedBy && (
                        <span>{item.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(item.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "编辑用户" : "新增用户"}
        maxWidth="620px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                登录账号 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入登录账号"
                value={form.username}
                onChange={(e) => updateForm("username", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                用户名 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入真实姓名"
                value={form.realName}
                onChange={(e) => updateForm("realName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                登录密码{" "}
                {editingItem && (
                  <span className="text-[#78716C] font-normal">(留空则不修改)</span>
                )}
                {!editingItem && <span className="text-[#78716C]">*</span>}
              </label>
              <input
                type="password"
                className="ios-input"
                placeholder={editingItem ? "留空则不修改" : "请输入密码"}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                手机号
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入手机号"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                className="ios-input"
                placeholder="请输入邮箱"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                部门
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入部门"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">
              <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              分配角色
            </label>
            {roles.length > 0 ? (
              <div className="space-y-1.5">
                {roles.map((role) => {
                  const checked = form.roleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150 ${
                        checked ? "bg-[#1C1917]/6" : "bg-white hover:bg-[#FFFFFF]"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                          checked ? "border-[#1C1917] bg-[#1C1917]" : "border-[#D1D5DB] bg-white"
                        }`}
                      >
                        {checked && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <span className={`text-[14px] font-semibold flex-1 ${checked ? "text-[#1C1917]" : "text-[#1C1917]"}`}>
                        {role.name}
                      </span>
                      {role.isProjectRole && (
                        <span className="ios-badge ios-badge-orange !text-[10px] !px-1.5 !py-0">
                          项目关联
                        </span>
                      )}
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => toggleRole(role.id)}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-[13px] text-[#78716C] py-3">加载角色中...</div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">
              头像
            </label>
            <input
              ref={avatarInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg"
              onChange={handleAvatarUpload}
            />
            <div className="flex items-center gap-4">
              <div className="relative group">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="头像预览"
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#E7E5E4]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#1C1917]/10 flex items-center justify-center border-2 border-[#E7E5E4]">
                    <span className="text-[20px] font-bold text-[#1C1917]">
                      {form.realName ? form.realName.charAt(0) : "?"}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="absolute inset-0 w-16 h-16 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "上传中..." : "上传头像"}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                    onClick={handleRemoveAvatar}
                  >
                    <X className="w-3.5 h-3.5" />
                    移除头像
                  </button>
                )}
                <span className="text-[11px] text-[#78716C]">支持 png、jpg、jpeg，建议正方形图片</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">
              <Image className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              电子签名
            </label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg"
              onChange={handleSignatureUpload}
            />
            {signaturePreview ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]">
                  <img
                    src={signaturePreview}
                    alt="电子签名预览"
                    className="max-h-[120px] max-w-full object-contain mx-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="ios-btn ios-btn-secondary ios-btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    重新上传
                  </button>
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                    onClick={handleRemoveSignature}
                  >
                    <X className="w-3.5 h-3.5" />
                    移除签名
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full py-8 rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#FFFFFF] hover:bg-[#FAFAF9] hover:border-[#1C1917]/40 transition-all duration-150 flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-6 h-6 text-[#1C1917] animate-spin" />
                    <span className="text-[13px] text-[#78716C]">上传中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-[#78716C]" />
                    <span className="text-[13px] text-[#78716C]">
                      点击上传电子签名（png、jpg、jpeg）
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary gap-1.5"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {editingItem ? "保存修改" : "创建用户"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除用户{" "}
            <span className="font-semibold">{deleteConfirm?.realName}</span>{" "}
            吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger gap-1.5"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
