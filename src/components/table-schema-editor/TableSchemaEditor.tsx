import React, { useState } from "react";
import { useCustomMutation } from "@refinedev/core";
import { TableInfo, TableColumn } from "../../types/manticore";
import { toastMessages } from "../../utils/toast";

interface TableSchemaEditorProps {
  table: TableInfo;
  onClose: () => void;
  onTableUpdated: (updatedTable: TableInfo) => void;
}

interface NewColumn {
  field: string;
  type: string;
  properties: string;
  engine?: string;
}

const SUPPORTED_TYPES = [
  'int', 'integer', 'bigint', 'float', 'bool', 'multi', 'multi64',
  'json', 'string', 'timestamp', 'text', 'text indexed', 'text stored',
  'text indexed stored', 'text indexed attribute', 'float_vector'
];

const VECTOR_KNN_TYPES = ['hnsw', 'ivf'];
const VECTOR_SIMILARITIES = ['l2', 'cosine', 'ip'];

export const TableSchemaEditor: React.FC<TableSchemaEditorProps> = ({
  table,
  onClose,
  onTableUpdated
}) => {
  const [columns, setColumns] = useState<TableColumn[]>(table.columns || []);
  const [newColumn, setNewColumn] = useState<NewColumn>({
    field: '',
    type: 'string',
    properties: '',
    engine: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'modify' | 'drop'>('add');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [modifyType, setModifyType] = useState<string>('bigint');

  // Vector-specific states
  const [vectorConfig, setVectorConfig] = useState({
    knn_type: 'hnsw',
    knn_dims: '128',
    hnsw_similarity: 'l2'
  });

  const { mutate: executeAlter } = useCustomMutation();
  const { mutate: refreshTableInfo } = useCustomMutation();

  const refreshTable = () => {
    refreshTableInfo(
      {
        url: "/table-info",
        method: "post",
        values: { table: table.name },
      },
      {
        onSuccess: (data) => {
          const updatedTable = data.data as TableInfo;
          setColumns(updatedTable.columns || []);
          onTableUpdated(updatedTable);
        },
        onError: (error) => {
          console.error('Failed to refresh table info:', error);
        }
      }
    );
  };

  const executeAlterCommand = (command: string) => {
    setIsLoading(true);
    
    // Add debugging
    console.log('Executing ALTER command:', command);
    
    executeAlter(
      {
        url: "/cli_json",
        method: "post",
        values: { 
          command: command
        },
      },
      {
        onSuccess: () => {
          toastMessages.alterSuccess();
          refreshTable();
          setIsLoading(false);
          
          // Reset forms
          if (activeTab === 'add') {
            setNewColumn({ field: '', type: 'string', properties: '', engine: '' });
            setVectorConfig({ knn_type: 'hnsw', knn_dims: '128', hnsw_similarity: 'l2' });
          }
        },
        onError: (error) => {
          console.error('ALTER command failed:', error);
          toastMessages.alterError(error.message || 'Failed to execute ALTER command');
          setIsLoading(false);
        }
      }
    );
  };

  const handleAddColumn = () => {
    if (!newColumn.field || !newColumn.type) {
      toastMessages.alterError('Field name and type are required');
      return;
    }

    let typeDefinition = newColumn.type.toLowerCase();
    
    // Handle vector type with special configuration
    if (newColumn.type === 'float_vector') {
      typeDefinition = `float_vector knn_type='${vectorConfig.knn_type}' knn_dims='${vectorConfig.knn_dims}' hnsw_similarity='${vectorConfig.hnsw_similarity}'`;
    }

    // Add engine specification if provided (only for specific types)
    const enginePart = newColumn.engine ? ` engine='${newColumn.engine}'` : '';
    
    const command = `ALTER TABLE ${table.name} ADD COLUMN ${newColumn.field} ${typeDefinition}${enginePart}`;
    console.log('Generated ADD COLUMN command:', command);
    executeAlterCommand(command);
  };

  const handleDropColumn = () => {
    if (!selectedColumn) {
      toastMessages.alterError('Please select a column to drop');
      return;
    }

    if (selectedColumn === 'id') {
      toastMessages.alterError('Cannot delete the id column');
      return;
    }

    const command = `ALTER TABLE ${table.name} DROP COLUMN ${selectedColumn}`;
    executeAlterCommand(command);
  };

  const handleModifyColumn = () => {
    if (!selectedColumn) {
      toastMessages.alterError('Please select a column to modify');
      return;
    }

    const command = `ALTER TABLE ${table.name} MODIFY COLUMN ${selectedColumn} ${modifyType}`;
    executeAlterCommand(command);
  };

  const renderVectorConfig = () => {
    if (newColumn.type !== 'float_vector') return null;

    return (
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
        <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center">
          <span className="mr-2">🧠</span>
          Vector Configuration
        </h4>
        <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
          Configure vector search parameters for semantic similarity and AI-powered search capabilities.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              KNN Type
            </label>
            <select
              value={vectorConfig.knn_type}
              onChange={(e) => setVectorConfig({...vectorConfig, knn_type: e.target.value})}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {VECTOR_KNN_TYPES.map(type => (
                <option key={type} value={type}>{type.toUpperCase()}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              HNSW: Fast approximate search
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dimensions
            </label>
            <input
              type="number"
              value={vectorConfig.knn_dims}
              onChange={(e) => setVectorConfig({...vectorConfig, knn_dims: e.target.value})}
              placeholder="e.g., 128, 256, 512"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Match your embedding model
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Similarity Metric
            </label>
            <select
              value={vectorConfig.hnsw_similarity}
              onChange={(e) => setVectorConfig({...vectorConfig, hnsw_similarity: e.target.value})}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {VECTOR_SIMILARITIES.map(sim => (
                <option key={sim} value={sim}>{sim.toUpperCase()}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              L2: Euclidean distance
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                Edit Schema: {table.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Manage columns and structure for your table
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Left Panel: Current Schema */}
            <div className="p-4 sm:p-6 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Current Schema ({columns.length} columns)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Review existing columns before making changes
                </p>
              </div>

              {/* Important Notes */}
              <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Schema Guidelines
                    </h4>
                    <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Backup your table before schema changes</li>
                        <li>Queries are blocked during column operations</li>
                        <li>The 'id' column cannot be deleted</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schema Grid */}
              <div className="space-y-3">
                {columns.map((column, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border transition-colors ${
                      column.field === 'id' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {column.field}
                          </span>
                          {column.field === 'id' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {column.type}
                        </div>
                        {column.properties && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {column.properties}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                          {column.type.includes('vector') && '🧠 '}
                          {column.type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Actions */}
            <div className="p-4 sm:p-6 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                  Schema Actions
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Choose an action to modify your table schema
                </p>
              </div>

              {/* Action Tabs */}
              <div className="mb-6">
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {[
                    { id: 'add', label: 'Add', icon: '➕', color: 'green' },
                    { id: 'modify', label: 'Modify', icon: '✏️', color: 'blue' },
                    { id: 'drop', label: 'Drop', icon: '🗑️', color: 'red' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'add' | 'modify' | 'drop')}
                      className={`flex items-center justify-center space-x-1 py-2 px-3 rounded-md font-medium text-sm transition-all ${
                        activeTab === tab.id
                          ? `bg-${tab.color}-100 text-${tab.color}-700 dark:bg-${tab.color}-900/50 dark:text-${tab.color}-300 shadow-sm`
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {activeTab === 'add' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center">
                        <span className="mr-2">➕</span>
                        Add New Column
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Create a new column with the specified field name and data type.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Field Name *
                        </label>
                        <input
                          type="text"
                          value={newColumn.field}
                          onChange={(e) => setNewColumn({...newColumn, field: e.target.value})}
                          placeholder="e.g., description, price, category"
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Data Type *
                          </label>
                          <select
                            value={newColumn.type}
                            onChange={(e) => setNewColumn({...newColumn, type: e.target.value})}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            {SUPPORTED_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Engine
                          </label>
                          <select
                            value={newColumn.engine}
                            onChange={(e) => setNewColumn({...newColumn, engine: e.target.value})}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">Default</option>
                            <option value="columnar">Columnar</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {renderVectorConfig()}

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={handleAddColumn}
                        disabled={isLoading || !newColumn.field || !newColumn.type}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Adding...</span>
                          </>
                        ) : (
                          <>
                            <span>➕</span>
                            <span>Add Column</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'modify' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center">
                        <span className="mr-2">✏️</span>
                        Modify Column Type
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Currently supports expanding INT columns to BIGINT. Select a column and confirm the change.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Select Column *
                        </label>
                        <select
                          value={selectedColumn}
                          onChange={(e) => setSelectedColumn(e.target.value)}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Choose a column</option>
                          {columns.filter(col => col.type.toLowerCase().includes('int')).map(column => (
                            <option key={column.field} value={column.field}>
                              {column.field} ({column.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          New Type
                        </label>
                        <select
                          value={modifyType}
                          onChange={(e) => setModifyType(e.target.value)}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="BIGINT">BIGINT</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={handleModifyColumn}
                        disabled={isLoading || !selectedColumn}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Modifying...</span>
                          </>
                        ) : (
                          <>
                            <span>✏️</span>
                            <span>Modify Column</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'drop' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center">
                        <span className="mr-2">🗑️</span>
                        Drop Column
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        ⚠️ <strong>Warning:</strong> This will permanently delete the column and all its data. This action cannot be undone.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Column to Drop *
                      </label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Choose a column to drop</option>
                        {columns.filter(col => col.field !== 'id').map(column => (
                          <option key={column.field} value={column.field}>
                            {column.field} ({column.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedColumn && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>Confirm:</strong> You are about to drop the column "{selectedColumn}". 
                          All data in this column will be permanently lost.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={handleDropColumn}
                        disabled={isLoading || !selectedColumn}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Dropping...</span>
                          </>
                        ) : (
                          <>
                            <span>🗑️</span>
                            <span>Drop Column</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
