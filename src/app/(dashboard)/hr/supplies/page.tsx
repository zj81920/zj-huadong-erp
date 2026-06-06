"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  Eye,
  MapPin,
  FileText,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { getUserModulePerms, canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";

interface OfficeSupply {
  id: string;
  name: string;
  category: string | null;
  spec: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  storeLocation: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
}

interface OfficeSupplyFormData {
  name: string;
  category: string;
  spec: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  storeLocation: string;
  remark: string;
}

const emptyForm: OfficeSupplyFormData = {
  name: "",
  category: "",
  spec: "",
  unit: "",
  quantity: "0",
  unitPrice: "0",
  storeLocation: "",
  remark: "",
};

const categoryOptions = [
  { value: "文具", label: "文具" },
  { value: "打印耗材", label: "打印耗材" },
  { value: "办公设备", label: "办公设备" },
  { value: "清洁用品", label: "清洁用品" },
  { value: "其他", label: "其他" },
];

const categoryColorMap: Record<string, string> = {
  文具: "ios-badge-blue",
  打印耗材: "ios-badge-orange",
  办公设备: "ios-badge-green",
  清洁用品: "ios-badge-purple",
  其他: "ios-badge-gray",
};

export default function SuppliesPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "office_supplies");

  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficeSupply | null>(null);
  const [form, setForm] = useState<OfficeSupplyFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailItem, setDetailItem] = useState<OfficeSupply | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OfficeSupply | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSupplies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("category", filterCategory);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/office-supplies?${params}`);
      const json = await res.json();

      if (res.ok) {
        setSupplies(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取办公用品列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, page, pageSize]);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: OfficeSupply) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category || "",
      spec: item.spec || "",
      unit: item.unit || "",
      quantity: String(item.quantity),
      unitPrice: item.unitPrice || "0",
      storeLocation: item.storeLocation || "",
      remark: item.remark || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const calcTotalPrice = (qty: string, price: string): string => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    return (q * p).toFixed(2);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    const quantity = parseInt(form.quantity) || 0;
    const unitPrice = parseFloat(form.unitPrice) || 0;
    const totalPrice = quantity * unitPrice;

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category || null,
        spec: form.spec.trim() || null,
        unit: form.unit.trim() || null,
        quantity,
        unitPrice: unitPrice > 0 ? unitPrice : null,
        totalPrice: totalPrice > 0 ? totalPrice : null,
        storeLocation: form.storeLocation.trim() || null,
        remark: form.remark.trim() || null,
      };

      const url = editingItem
        ? `/api/office-supplies/${editingItem.id}`
        : "/api/office-supplies";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchSupplies();
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
      const res = await fetch(`/api/office-supplies/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchSupplies();
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

  const updateForm = (field: keyof OfficeSupplyFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDecimal = (val: string | null) => {
    if (!val) return "-";
    const num = parseFloat(val);
    return isNaN(num) ? "-" : num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>办公用品管理</h1>
            <p>管理公司办公用品库存信息</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增用品
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
              placeholder="搜索名称、规格、存放位置..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部分类</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination?.total ?? 0}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : supplies.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Package className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterCategory ? "没有匹配的办公用品记录" : "暂无办公用品，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>分类</th>
                  <th>规格</th>
                  <th>单位</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>总价</th>
                  <th>存放位置</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </td>
                    <td>
                      {item.category ? (
                        <span className={`ios-badge ${categoryColorMap[item.category] || "ios-badge-gray"}`}>
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>{item.spec || "-"}</td>
                    <td>{item.unit || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>{formatDecimal(item.unitPrice)}</td>
                    <td className="font-semibold">{formatDecimal(item.totalPrice)}</td>
                    <td>{item.storeLocation || "-"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => setDetailItem(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        {canEditFrontend(false, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        )}
                        {canDeleteFrontend(false, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
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

            <PaginationBar
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "编辑办公用品" : "新增办公用品"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">分类</label>
              <select
                className="ios-select"
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
              >
                <option value="">请选择</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">规格</label>
              <input
                type="text"
                className="ios-input"
                placeholder="规格型号"
                value={form.spec}
                onChange={(e) => updateForm("spec", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">单位</label>
              <input
                type="text"
                className="ios-input"
                placeholder="如：个、箱、盒"
                value={form.unit}
                onChange={(e) => updateForm("unit", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">数量</label>
              <input
                type="number"
                className="ios-input"
                placeholder="0"
                min="0"
                value={form.quantity}
                onChange={(e) => updateForm("quantity", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">单价（元）</label>
              <input
                type="number"
                className="ios-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => updateForm("unitPrice", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">总价（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#FAFAF9]"
                value={`¥ ${calcTotalPrice(form.quantity, form.unitPrice)}`}
                readOnly
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">存放位置</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="存放位置"
                  value={form.storeLocation}
                  onChange={(e) => updateForm("storeLocation", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
                <textarea
                  className="ios-input pl-10 min-h-[80px] resize-none"
                  placeholder="备注信息"
                  value={form.remark}
                  onChange={(e) => updateForm("remark", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建用品"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="用品详情"
        maxWidth="500px"
      >
        {detailItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">名称</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailItem.name}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">分类</p>
                <p>{detailItem.category ? (
                  <span className={`ios-badge ${categoryColorMap[detailItem.category] || "ios-badge-gray"}`}>
                    {detailItem.category}
                  </span>
                ) : "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">规格</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.spec || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">单位</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.unit || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">数量</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.quantity}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">单价</p>
                <p className="text-[14px] text-[#1C1917]">{formatDecimal(detailItem.unitPrice)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">总价</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDecimal(detailItem.totalPrice)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">存放位置</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.storeLocation || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[12px] text-[#78716C] mb-0.5">备注</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.remark || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.createdAt)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">更新时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.updatedAt)}</p>
              </div>
            </div>
          </div>
        )}
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
            确定要删除办公用品 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
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
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
