import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { adminApi } from "../../api/adminApi";
import { hostelApi } from "../../api/hostelApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { SearchField } from "../../components/common/SearchField";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ROLE_LABELS } from "../../utils/constants";

const CREATE_DEFAULTS = {
  name: "",
  email: "",
  password: "",
  role: "student",
  hostelId: "",
  studentIdMode: "automatic",
  studentId: "",
  gender: "male",
  isEBL: "false",
};
const FORM_DEFAULTS = {
  ...CREATE_DEFAULTS,
  isActive: "true",
};

const ROLE_OPTIONS = ["student", "caretaker", "warden", "dean"];
const HOSTEL_BOUND_ROLES = ["student", "caretaker"];

export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const formRef = useRef(null);
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminApi.listUsers,
  });
  const hostelsQuery = useQuery({
    queryKey: ["admin-hostels-list"],
    queryFn: hostelApi.list,
  });

  const userForm = useForm({ defaultValues: FORM_DEFAULTS });

  const formRole = userForm.watch("role");
  const formStudentIdMode = userForm.watch("studentIdMode");
  const isEditMode = Boolean(selectedUser);

  const createMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      toast.success("User created successfully.");
      userForm.reset(FORM_DEFAULTS);
      usersQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to create user.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminApi.updateUser(id, payload),
    onSuccess: () => {
      toast.success("User updated successfully.");
      setSelectedUser(null);
      userForm.reset(FORM_DEFAULTS);
      usersQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update user.");
    },
  });

  useEffect(() => {
    if (!selectedUser) {
      userForm.reset(FORM_DEFAULTS);
      return;
    }

    userForm.reset({
      ...FORM_DEFAULTS,
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      password: "",
      role: selectedUser.role || "student",
      hostelId: selectedUser.hostelId?._id || "",
      isActive: String(selectedUser.isActive ?? true),
      studentIdMode: selectedUser.studentProfile?.isTemporaryId ? "automatic" : "manual",
      studentId: selectedUser.studentProfile?.studentId || "",
      gender: selectedUser.studentProfile?.gender || "male",
      isEBL: String(selectedUser.studentProfile?.isEBL ?? false),
    });
  }, [selectedUser, userForm]);

  useEffect(() => {
    if (!selectedUser || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedUser]);

  const rows = useMemo(() => {
    const items = usersQuery.data?.data || [];
    const query = search.trim().toLowerCase();

    if (!query) return items;

    return items.filter((user) =>
      [
        user.name,
        user.email,
        user.role,
        user.hostelId?.name,
        user.studentProfile?.studentId,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [search, usersQuery.data?.data]);

  if (usersQuery.isLoading || hostelsQuery.isLoading) {
    return <LoadingState label="Loading users..." />;
  }

  if (usersQuery.isError || hostelsQuery.isError) {
    return (
      <ErrorState
        description="Unable to load admin user management data."
        onRetry={() => {
          usersQuery.refetch();
          hostelsQuery.refetch();
        }}
      />
    );
  }

  const hostels = hostelsQuery.data?.data || [];

  const buildPayload = (values, mode = "create") => {
    const payload = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
      hostelId: HOSTEL_BOUND_ROLES.includes(values.role) ? values.hostelId || undefined : null,
    };

    if (mode === "create") {
      payload.password = values.password;
    } else {
      payload.isActive = values.isActive === "true";
    }

    if (values.role === "student") {
      payload.studentIdMode = values.studentIdMode;
      if (values.studentIdMode === "manual") {
        payload.studentId = values.studentId.trim();
      }
      payload.gender = values.gender;
      payload.isEBL = values.isEBL === "true";
    }

    return payload;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="User management"
        description="Create, update, and manage student, caretaker, warden, and dean accounts from one admin workspace."
      />

      <form
        ref={formRef}
        className="panel p-6"
        onSubmit={userForm.handleSubmit((values) => {
          if (isEditMode) {
            updateMutation.mutate({ id: selectedUser.id, payload: buildPayload(values, "edit") });
            return;
          }

          createMutation.mutate(buildPayload(values, "create"));
        })}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="section-title">{isEditMode ? "Update user" : "Create user"}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {isEditMode ? `Editing ${selectedUser.name}` : "Use this single form to create a new user or edit an existing one."}
            </p>
          </div>
          {isEditMode ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedUser(null);
                userForm.reset(FORM_DEFAULTS);
              }}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="field-label">Name</label>
            <Input {...userForm.register("name", { required: "Name is required" })} />
            {userForm.formState.errors.name ? (
              <p className="mt-2 text-sm text-rose-500">{userForm.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Email</label>
            <Input type="email" {...userForm.register("email", { required: "Email is required" })} />
            {userForm.formState.errors.email ? (
              <p className="mt-2 text-sm text-rose-500">{userForm.formState.errors.email.message}</p>
            ) : null}
          </div>
          {!isEditMode ? (
            <>
            <div>
              <label className="field-label">Password</label>
              <Input type="password" {...userForm.register("password", { required: "Password is required" })} />
            </div>
            <div />
            </>
          ) : null}
          <div>
            <label className="field-label">Role</label>
            <Select {...userForm.register("role")}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          {isEditMode ? (
            <div>
              <label className="field-label">Status</label>
              <Select {...userForm.register("isActive")}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </div>
          ) : (
            <div />
          )}
          {HOSTEL_BOUND_ROLES.includes(formRole) ? (
            <div className="md:col-span-2">
              <label className="field-label">Hostel</label>
              <Select {...userForm.register("hostelId", { required: "Hostel is required for this role" })}>
                <option value="">Select hostel</option>
                {hostels.map((hostel) => (
                  <option key={hostel._id} value={hostel._id}>
                    {hostel.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {formRole === "student" ? (
            <>
              <div>
                <label className="field-label">Student ID Mode</label>
                <Select {...userForm.register("studentIdMode")}>
                  <option value="automatic">Automatic temporary ID</option>
                  <option value="manual">Manual actual ID</option>
                </Select>
              </div>
              <div>
                <label className="field-label">Student ID</label>
                <Input
                  disabled={formStudentIdMode !== "manual"}
                  placeholder={
                    formStudentIdMode === "manual"
                      ? "Enter actual student ID"
                      : isEditMode
                        ? "Temporary ID remains active"
                        : "Auto-generated after save"
                  }
                  {...userForm.register("studentId", {
                    validate: (value) =>
                      formStudentIdMode !== "manual" || value.trim() ? true : "Student ID is required",
                  })}
                />
              </div>
              <div>
                <label className="field-label">Gender</label>
                <Select {...userForm.register("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </div>
              <div>
                <label className="field-label">EBL Student</label>
                <Select {...userForm.register("isEBL")}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-5 flex gap-3">
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEditMode ? "Update user" : "Create user"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSelectedUser(null);
              userForm.reset(FORM_DEFAULTS);
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <div className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="section-title">All users</h2>
            <p className="mt-2 text-sm text-slate-500">
              Review role, hostel assignment, and active status across the institution.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, role, email, hostel, or student ID"
            />
          </div>
        </div>

        <div className="mt-6">
          <DataTable
            rows={rows}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email", render: (row) => row.email || "-" },
              { key: "role", label: "Role", render: (row) => ROLE_LABELS[row.role] || row.role },
              { key: "hostel", label: "Hostel", render: (row) => row.hostelId?.name || "-" },
              {
                key: "studentId",
                label: "Student ID",
                render: (row) =>
                  row.role === "student"
                    ? `${row.studentProfile?.studentId || "-"}${row.studentProfile?.isTemporaryId ? " (temp)" : ""}`
                    : "-",
              },
              {
                key: "eblMeta",
                label: "EBL",
                render: (row) =>
                  row.role === "student"
                    ? row.studentProfile?.isEBL
                      ? "Yes"
                      : "No"
                    : "-",
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusBadge value={row.isActive ? "active" : "inactive"} />,
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedUser(row)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateMutation.mutate({
                          id: row.id,
                          payload: { isActive: !row.isActive },
                        })
                      }
                    >
                      {row.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No users available yet."
          />
        </div>
      </div>
    </div>
  );
}
