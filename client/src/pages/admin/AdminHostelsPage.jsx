import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { hostelApi } from "../../api/hostelApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { SearchField } from "../../components/common/SearchField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export function AdminHostelsPage() {
  const [search, setSearch] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      type: "boys",
      location: "",
    },
  });

  const hostelsQuery = useQuery({
    queryKey: ["admin-hostels"],
    queryFn: hostelApi.list,
  });

  const createMutation = useMutation({
    mutationFn: hostelApi.create,
    onSuccess: () => {
      toast.success("Hostel created successfully.");
      reset({ name: "", type: "boys", location: "" });
      hostelsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to create hostel.");
    },
  });

  const rows = useMemo(() => {
    const hostels = hostelsQuery.data?.data || [];
    const query = search.trim().toLowerCase();

    if (!query) return hostels;

    return hostels.filter((hostel) =>
      [hostel.name, hostel.type, hostel.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [hostelsQuery.data?.data, search]);

  if (hostelsQuery.isLoading) return <LoadingState label="Loading hostels..." />;
  if (hostelsQuery.isError) {
    return <ErrorState description="Unable to load hostels." onRetry={hostelsQuery.refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hostels"
        title="Hostel registry"
        description="Create the hostels your operations depend on, then assign caretakers and students against them."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="panel p-6" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <h2 className="section-title">Create hostel</h2>
          <p className="mt-2 text-sm text-slate-500">
            This is the first bootstrap step after recreating an admin account.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="field-label">Hostel name</label>
              <Input
                placeholder="e.g. Boys Hostel A"
                {...register("name", { required: "Hostel name is required" })}
              />
              {errors.name ? <p className="mt-2 text-sm text-rose-500">{errors.name.message}</p> : null}
            </div>

            <div>
              <label className="field-label">Hostel type</label>
              <Select {...register("type", { required: true })}>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
              </Select>
            </div>

            <div>
              <label className="field-label">Location</label>
              <Input placeholder="e.g. Main Campus" {...register("location")} />
            </div>
          </div>

          <div className="mt-5">
            <Button type="submit" loading={createMutation.isPending}>
              Create hostel
            </Button>
          </div>
        </form>

        <div className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="section-title">Existing hostels</h2>
              <p className="mt-2 text-sm text-slate-500">
                Review every hostel available for assignment and billing operations.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <SearchField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, type, or location"
              />
            </div>
          </div>

          <div className="mt-6">
            <DataTable
              rows={rows}
              columns={[
                { key: "name", label: "Hostel" },
                { key: "type", label: "Type", render: (row) => row.type?.toUpperCase() || "-" },
                { key: "location", label: "Location" },
                { key: "createdAt", label: "Created", type: "date" },
              ]}
              emptyMessage="No hostels created yet."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
