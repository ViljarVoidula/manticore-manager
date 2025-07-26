import React, { useState, useEffect, useCallback } from "react";
import { useCustomMutation } from "@refinedev/core";
import { useNavigate } from "react-router";
import { TableInfo } from "../../types/manticore";

interface TableStats {
  name: string;
  recordCount: number;
  loading: boolean;
  error?: string;
}

export const Dashboard: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [serverStatus, setServerStatus] = useState<{
    status: 'checking' | 'connected' | 'error';
    message: string;
  }>({ status: 'checking', message: 'Checking connection...' });
  
  const navigate = useNavigate();
  const { mutate: fetchTables } = useCustomMutation();
  const { mutate: checkServerStatus } = useCustomMutation();
  const { mutate: getTableCount } = useCustomMutation();

  // Load tables and their stats
  const loadTables = useCallback(() => {
    fetchTables(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: (data) => {
          const tablesData = (data.data as unknown[]) as TableInfo[];
          setTables(tablesData);
          
          // Initialize table stats
          const initialStats = tablesData.map(table => ({
            name: table.name,
            recordCount: 0,
            loading: true
          }));
          setTableStats(initialStats);
          
          // Fetch record count for each table sequentially to avoid race conditions
          const fetchCountsSequentially = async () => {
            for (let i = 0; i < tablesData.length; i++) {
              const table = tablesData[i];
              console.log(`[${i + 1}/${tablesData.length}] Fetching count for table: ${table.name}`);
              
              try {
                await new Promise<void>((resolve, reject) => {
                  // Set a timeout to prevent hanging requests
                  const timeoutId = setTimeout(() => {
                    console.warn(`Timeout fetching count for table: ${table.name}`);
                    setTableStats(prev => prev.map(stat => 
                      stat.name === table.name 
                        ? { 
                            ...stat, 
                            recordCount: 0,
                            loading: false,
                            error: 'Timeout'
                          }
                        : stat
                    ));
                    reject(new Error('Timeout'));
                  }, 5000); // Reduced to 5 second timeout
                  
                  getTableCount(
                    {
                      url: "/sql",
                      method: "post",
                      values: { 
                        query: `SELECT COUNT(*) as count FROM ${table.name}`,
                        raw_response: false
                      },
                    },
                    {
                      onSuccess: (countData) => {
                        clearTimeout(timeoutId);
                        console.log(`✅ Count received for table ${table.name}:`, countData);
                        console.log(`Full count data structure:`, JSON.stringify(countData, null, 2));
                        
                        // Handle different response formats
                        let totalHits = 0;
                        
                        try {
                          // JSON format response from /sql endpoint
                          if (countData.data?.hits?.hits?.[0]?._source?.count !== undefined) {
                            totalHits = countData.data.hits.hits[0]._source.count;
                          }
                          // Raw format response (array format)
                          else if (Array.isArray(countData.data) && countData.data[0]?.data?.[0]?.count !== undefined) {
                            totalHits = countData.data[0].data[0].count;
                          }
                          // Alternative raw format
                          else if (countData.data?.data?.[0]?.count !== undefined) {
                            totalHits = countData.data.data[0].count;
                          }
                          // Try to find count in nested structures
                          else if (countData.data?.hits?.total !== undefined) {
                            totalHits = countData.data.hits.total;
                          }
                          // Search for any count field recursively
                          else {
                            const findCount = (obj: unknown): number => {
                              if (typeof obj === 'number') return obj;
                              if (typeof obj !== 'object' || obj === null) return 0;
                              
                              const record = obj as Record<string, unknown>;
                              
                              // Check for common count field names
                              if (record.count !== undefined) return Number(record.count);
                              if (record.total !== undefined) return Number(record.total);
                              if (record['COUNT(*)'] !== undefined) return Number(record['COUNT(*)']);
                              
                              // Recursively search in nested objects and arrays
                              for (const value of Object.values(record)) {
                                const result = findCount(value);
                                if (result > 0) return result;
                              }
                              return 0;
                            };
                            
                            totalHits = findCount(countData);
                          }
                        } catch (error) {
                          console.error(`Error parsing count for table ${table.name}:`, error);
                          totalHits = 0;
                        }
                        
                        console.log(`Final count for table ${table.name}: ${totalHits}`);
                        
                        setTableStats(prev => prev.map(stat => 
                          stat.name === table.name 
                            ? { 
                                ...stat, 
                                recordCount: totalHits,
                                loading: false 
                              }
                            : stat
                        ));
                        resolve();
                      },
                      onError: (error) => {
                        clearTimeout(timeoutId);
                        console.error(`❌ Failed to get count for table ${table.name} via SQL:`, error);
                        
                        // Try fallback to search API
                        console.log(`🔄 Trying fallback search API for table: ${table.name}`);
                        getTableCount(
                          {
                            url: "/search",
                            method: "post",
                            values: { 
                              table: table.name,
                              limit: 0,
                              query: { match_all: {} }
                            },
                          },
                          {
                            onSuccess: (searchData) => {
                              const totalHits = searchData.data?.hits?.total || 0;
                              console.log(`✅ Fallback count for table ${table.name}: ${totalHits}`);
                              setTableStats(prev => prev.map(stat => 
                                stat.name === table.name 
                                  ? { 
                                      ...stat, 
                                      recordCount: totalHits,
                                      loading: false 
                                    }
                                  : stat
                              ));
                              resolve();
                            },
                            onError: (fallbackError) => {
                              console.error(`❌ Fallback also failed for table ${table.name}:`, fallbackError);
                              setTableStats(prev => prev.map(stat => 
                                stat.name === table.name 
                                  ? { 
                                      ...stat, 
                                      recordCount: 0,
                                      loading: false,
                                      error: 'Failed to load count'
                                    }
                                  : stat
                              ));
                              resolve(); // Still resolve to continue with next table
                            }
                          }
                        );
                      }
                    }
                  );
                });
                
                // Add a small delay between requests to avoid overwhelming the server
                if (i < tablesData.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              } catch (error) {
                console.error(`Failed to process table ${table.name}:`, error);
                // Continue with next table even if this one failed
              }
            }
            console.log('✅ Finished fetching all table counts');
          };
          
          fetchCountsSequentially();
        },
        onError: (error) => {
          console.error('Failed to fetch tables:', error);
          setTables([]);
          setTableStats([]);
        }
      }
    );
  }, [fetchTables, getTableCount]);

  // Check server status
  const checkServer = useCallback(() => {
    setServerStatus({ status: 'checking', message: 'Checking connection...' });
    
    checkServerStatus(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: () => {
          setServerStatus({ 
            status: 'connected', 
            message: 'Connected' 
          });
        },
        onError: (error) => {
          console.error('Server status check failed:', error);
          setServerStatus({ 
            status: 'error', 
            message: 'Connection failed' 
          });
        }
      }
    );
  }, [checkServerStatus]);

  // Load data on mount
  useEffect(() => {
    loadTables();
    checkServer();
  }, [loadTables, checkServer]);

  const totalTables = tables.length;
  const totalRecords = tableStats.reduce((sum, stat) => sum + stat.recordCount, 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm lg:text-base">
          Welcome to Manticore Manager
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Tables Overview Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                Tables
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-xs lg:text-sm truncate">
                {totalTables > 0 ? `${totalRecords.toLocaleString()} total records` : 'No tables found'}
              </p>
            </div>
            <div className="text-xl lg:text-2xl ml-2">🗂️</div>
          </div>
          <div className="mt-3 lg:mt-4">
            <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalTables}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total tables
            </p>
          </div>
          
          {/* Table breakdown - Mobile optimized */}
          {tableStats.length > 0 && (
            <div className="mt-3 lg:mt-4 space-y-1 lg:space-y-2 max-h-24 lg:max-h-32 overflow-y-auto">
              {tableStats.map((stat) => (
                <div key={stat.name} className="flex justify-between items-center text-xs lg:text-sm">
                  <span className="text-gray-600 dark:text-gray-300 truncate pr-2">
                    {stat.name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {stat.loading ? '...' : stat.error ? 'Error' : stat.recordCount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SQL Editor Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                SQL Editor
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-xs lg:text-sm">
                Execute SQL queries
              </p>
            </div>
            <div className="text-xl lg:text-2xl ml-2">⚡</div>
          </div>
          <div className="mt-3 lg:mt-4">
            <div className="text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">
              Ready
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Status
            </p>
          </div>
        </div>

        {/* Server Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 lg:p-6 md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                Server Status
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-xs lg:text-sm">
                Manticore server connection
              </p>
            </div>
            <div className="text-xl lg:text-2xl ml-2">
              {serverStatus.status === 'connected' ? '🟢' : 
               serverStatus.status === 'error' ? '🔴' : '🟡'}
            </div>
          </div>
          <div className="mt-3 lg:mt-4">
            <div className={`text-lg lg:text-2xl font-bold ${
              serverStatus.status === 'connected' ? 'text-green-600 dark:text-green-400' :
              serverStatus.status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-yellow-600 dark:text-yellow-400'
            }`}>
              {serverStatus.message}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Connection status
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile friendly grid */}
      <div className="mt-6 lg:mt-8">
        <h2 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-3 lg:mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <button 
            onClick={() => navigate('/tables?create=true')}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-3 lg:px-4 py-3 rounded-lg text-sm lg:text-base font-medium transition-colors"
          >
            Create Table
          </button>
          <button 
            onClick={() => navigate('/sql')}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-3 lg:px-4 py-3 rounded-lg text-sm lg:text-base font-medium transition-colors"
          >
            Run SQL Query
          </button>
          <button 
            onClick={() => navigate('/tables')}
            className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white px-3 lg:px-4 py-3 rounded-lg text-sm lg:text-base font-medium transition-colors"
          >
            Manage Tables
          </button>
          <button 
            onClick={() => {
              loadTables();
              checkServer();
            }}
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white px-3 lg:px-4 py-3 rounded-lg text-sm lg:text-base font-medium transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};
