import React, { useState } from "react";
import { useCustomMutation } from "@refinedev/core";

interface TableField {
  name: string;
  type: 'text' | 'integer' | 'bigint' | 'float' | 'bool' | 'json' | 'timestamp' | 'float_vector';
  properties?: string;
}

interface TableCreatorProps {
  onTableCreated?: () => void;
  onClose?: () => void;
}

export const TableCreator: React.FC<TableCreatorProps> = ({ onTableCreated, onClose }) => {
  const [tableName, setTableName] = useState("");
  const [fields, setFields] = useState<TableField[]>([
    { name: "id", type: "bigint", properties: "" }
  ]);
  const [tableType, setTableType] = useState<'rt' | 'pq'>('rt'); // rt = real-time, pq = percolate
  const [error, setError] = useState<string | null>(null);

  const { mutate: createTable, isLoading } = useCustomMutation();

  const addField = () => {
    setFields([...fields, { name: "", type: "text", properties: "" }]);
  };

  const removeField = (index: number) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index));
    }
  };

  const updateField = (index: number, key: keyof TableField, value: string) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    setFields(updatedFields);
  };

  const generateCreateTableSQL = (): string => {
    const fieldDefinitions = fields
      .filter(field => field.name.trim())
      .map(field => {
        let definition = `${field.name} ${field.type}`;
        if (field.properties && field.properties.trim()) {
          definition += ` ${field.properties}`;
        }
        return definition;
      })
      .join(', ');

    return `CREATE TABLE ${tableName} (${fieldDefinitions})${tableType === 'rt' ? ' type=\'rt\'' : ' type=\'pq\''}`;
  };

  const handleCreate = () => {
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }

    if (fields.length === 0 || !fields.some(f => f.name.trim())) {
      setError("At least one field is required");
      return;
    }

    const sql = generateCreateTableSQL();
    setError(null);

    createTable(
      {
        url: "/cli_json",
        method: "post",
        values: {
          command: sql,
        },
      },
      {
        onSuccess: () => {
          onTableCreated?.();
          setTableName("");
          setFields([{ name: "id", type: "bigint", properties: "" }]);
        },
        onError: (error: any) => {
          setError(error.message || "Failed to create table");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Create New Table</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter table name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table Type
              </label>
              <select
                value={tableType}
                onChange={(e) => setTableType(e.target.value as 'rt' | 'pq')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="rt">Real-time (RT) - For regular documents</option>
                <option value="pq">Percolate (PQ) - For stored queries</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Fields
                </label>
                <button
                  onClick={addField}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Add Field
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(index, 'name', e.target.value)}
                      placeholder="Field name"
                      className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, 'type', e.target.value as TableField['type'])}
                      className="w-32 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="text">text</option>
                      <option value="integer">integer</option>
                      <option value="bigint">bigint</option>
                      <option value="float">float</option>
                      <option value="float_vector">float_vector</option>
                      <option value="bool">bool</option>
                      <option value="json">json</option>
                      <option value="timestamp">timestamp</option>
                    </select>
                    <input
                      type="text"
                      value={field.properties || ''}
                      onChange={(e) => updateField(index, 'properties', e.target.value)}
                      placeholder="Properties (optional)"
                      className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {fields.length > 1 && (
                      <button
                        onClick={() => removeField(index)}
                        className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated SQL
              </label>
              <textarea
                value={generateCreateTableSQL()}
                readOnly
                className="w-full h-20 p-3 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isLoading || !tableName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Table"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
