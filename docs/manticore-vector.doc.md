Installation
Vector search functionality has been available in Manticore since version 6.3.0. Make sure Manticore is installed with the Columnar library . If you need help with installation, check the documentation .

Creating a table
First, we need to create a real-time table that will contain our schema declaration. This includes a field for storing vectors, allowing us to query them using the specified syntax. Let’s create a simple table. The table should have a field of type float_vector with configured options.

create table test ( title text, image_vector float_vector knn_type='hnsw' knn_dims='4' hnsw_similarity='l2' );
You can read detailed docs here .

Inserting data
Once the table is set up, we need to populate it with some data before we can retrieve any information from it.

insert into test values ( 1, 'yellow bag', (0.653448,0.192478,0.017971,0.339821) ), ( 2, 'white bag', (-0.148894,0.748278,0.091892,-0.095406) );
Manticore Search supports SQL, making it user-friendly for those familiar with SQL databases. However, if you prefer to use plain HTTP requests, that option is available too! Here’s how you can perform the earlier SQL operation using HTTP:

POST /insert
{
    "index":"test_vec",
    "id":1,
    "doc":  { "title" : "yellow bag", "image_vector" : [0.653448,0.192478,0.017971,0.339821] }
}

POST /insert
{
    "index":"test_vec",
    "id":2,
    "doc":  { "title" : "white bag", "image_vector" : [-0.148894,0.748278,0.091892,-0.095406] }
}
Querying the data
The final step involves querying the results using our pre-calculated request vector, similar to the document vectors prepared with AI models. We will explain this process in more detail in the next part of our article. For now, here is an example of how to query data from a table using our ready vector:

mysql> select id, knn_dist() from test where knn ( image_vector, 5, (0.286569,-0.031816,0.066684,0.032926), 2000 );
You’ll get this:

+------+------------+
| id   | knn_dist() |
+------+------------+
|    1 | 0.28146550 |
|    2 | 0.81527930 |
+------+------------+
2 rows in set (0.00 sec)
That is, 2 documents sorted by the closeness of their vectors to the query vector.


Table Types
Manticore supports different types of tables:

Real-time tables - For real-time updates and immediate searchability
Plain tables - For static data that doesn't require frequent updates
Percolate tables - For storing and matching search queries
Template tables - For creating table templates
Distributed tables - For scaling across multiple nodes


Updating table schema in RT mode
ALTER TABLE table ADD COLUMN column_name [{INTEGER|INT|BIGINT|FLOAT|BOOL|MULTI|MULTI64|JSON|STRING|TIMESTAMP|TEXT [INDEXED [ATTRIBUTE]]}] [engine='columnar']

ALTER TABLE table DROP COLUMN column_name

ALTER TABLE table MODIFY COLUMN column_name bigint
This feature only supports adding one field at a time for RT tables or the expansion of an int column to bigint. The supported data types are:

int - integer attribute
timestamp - timestamp attribute
bigint - big integer attribute
float - float attribute
bool - boolean attribute
multi - multi-valued integer attribute
multi64 - multi-valued bigint attribute
json - json attribute
string / text attribute / string attribute - string attribute
text / text indexed stored / string indexed stored - full-text indexed field with original value stored in docstore
text indexed / string indexed - full-text indexed field, indexed only (the original value is not stored in docstore)
text indexed attribute / string indexed attribute - full text indexed field + string attribute (not storing the original value in docstore)
text stored / string stored - the value will be only stored in docstore, not full-text indexed, not a string attribute
adding engine='columnar' to any attribute (except for json) will make it stored in the columnar storage
Important notes:
❗It's recommended to backup table files before ALTERing it to avoid data corruption in case of a sudden power interruption or other similar issues.
Querying a table is impossible while a column is being added.
Newly created attribute's values are set to 0.
ALTER will not work for distributed tables and tables without any attributes.
You can't delete the id column.
When dropping a field which is both a full-text field and a string attribute the first ALTER DROP drops the attribute, the second one drops the full-text field.
Adding/dropping full-text field is only supported in the RT mode.

Renaming a real-time table
You can change the name of a real-time table in RT mode.

ALTER TABLE table_name RENAME new_table_name; 
NOTE: Renaming a real-time table requires Manticore Buddy. If it doesn't work, make sure Buddy is installed.



SQL over HTTP
Manticore provides /sql, /cli, and /cli_json endpoints for running SQL queries over HTTP. Each endpoint is designed for specific use cases:

/sql: Suitable for programmatic usage from applications.
The /sql endpoint accepts only SELECT statements and returns the response in HTTP JSON format.
The /sql?mode=raw endpoint accepts any SQL query and returns the response in raw format, similar to what you would receive via mysql.
/cli: Intended only for manual use (e.g., via curl or browser). Not recommended for scripts.
/cli_json: Similar to /cli, but returns results in JSON format. Not recommended for scripts.
/sql
General syntax:

curl "localhost:6780/sql[?mode=raw]&query={URL_ENCODED_QUERY}"
curl localhost:6780/sql[?mode=raw] -d "[query={URL_ENCODED_QUERY}|{NOT_URL_ENCODED_QUERY}]"
The /sql endpoint accepts an SQL query via the HTTP JSON interface:

Without mode=raw- only SELECTs are allowed, returning the response in JSON format.
With mode=raw - any SQL query is permitted, returning the response in raw format.
The endpoint can handle HTTP requests using either the GET or the POST method. For sending queries, you can:

Using GET: Include the query in the query parameter of the URL, like /sql?query=your_encoded_query_here. It's important to URL encode this parameter to avoid errors, especially if the query includes an = sign, which might be interpreted as part of the URL syntax rather than the query.
Using POST: You can also send the query within the body of a POST request. When using this method:
If you send the query as a parameter named query, ensure it is URL encoded.
If you send the query directly as plain text (a raw POST body), do not URL encode it. This is useful when the query is long or complex, or if the query is stored in a file and you want to send it as is by pointing your HTTP client (e.g., curl) to it.
This approach keeps the usage of GET and POST distinct and avoids any confusion about combining methods in a single request.

Without mode=raw the response is a JSON containing information about the hits and the execution time. The response format is the same as the json/search endpoint. Note that the /sql endpoint only supports single search requests. For processing a multi-query, see the section below about the raw mode.

‹›
POST
POST URL-encoded
GET URL-encoded
📋
POST /sql
select id,subject,author_id  from forum where match('@subject php manticore') group by author_id order by id desc limit 0,5
‹›
Response
{
  "took": 0,
  "timed_out": false,
  "hits": {
    "total": 2,
    "total_relation": "eq",
    "hits": [
      {
        "_id": 2,
        "_score": 2356,
        "_source": {
          "subject": "php manticore",
          "author_id": 12
        }
      },
      {
        "_id": 1,
        "_score": 2356,
        "_source": {
          "subject": "php manticore",
          "author_id": 11
        }
      }
    ]
  }
}
mode=raw
The /sql endpoint also includes a special "raw" mode, which allows you to send any valid SQL queries, including multi-queries. The response is a JSON array containing one or more result sets. You can activate this mode by using the option mode=raw.

‹›
POST
POST URL-encoded
POST URL-encoded 2nd way
GET URL-encoded
curl examples
📋
POST /sql?mode=raw
desc test
‹›
Response
[
  {
    "columns": [
      {
        "Field": {
          "type": "string"
        }
      },
      {
        "Type": {
          "type": "string"
        }
      },
      {
        "Properties": {
          "type": "string"
        }
      }
    ],
    "data": [
      {
        "Field": "id",
        "Type": "bigint",
        "Properties": ""
      },
      {
        "Field": "title",
        "Type": "text",
        "Properties": "indexed"
      },
      {
        "Field": "gid",
        "Type": "uint",
        "Properties": ""
      },
      {
        "Field": "title",
        "Type": "string",
        "Properties": ""
      },
      {
        "Field": "j",
        "Type": "json",
        "Properties": ""
      },
      {
        "Field": "new1",
        "Type": "uint",
        "Properties": ""
      }
    ],
    "total": 6,
    "error": "",
    "warning": ""
  }
]
/cli
NOTE: /cli requires Manticore Buddy. If it doesn't work, make sure Buddy is installed.

NOTE: The /cli endpoint is designed for manual interaction with Manticore using tools like curl or a browser. It is not intended for use in automated scripts. Use the /sql endpoint instead.

While the /sql endpoint is useful for controlling Manticore programmatically from your application, there's also the /cli endpoint. This makes it easier to manually maintain a Manticore instance using curl or your browser. It accepts both POST and GET HTTP methods. Everything inputted after /cli? is understood by Manticore, even if it's not manually escaped with curl or automatically encoded by the browser. No query parameter is required. Importantly, the + sign is not changed to a space, eliminating the need for encoding it. For the POST method, Manticore accepts everything exactly as it is, without any changes. The response is in tabular format, similar to an SQL result set you might see in a MySQL client.

‹›
POST
GET
Browser
curl example
📋
POST /cli
desc test
‹›
Response
+-------+--------+----------------+
| Field | Type   | Properties     |
+-------+--------+----------------+
| id    | bigint |                |
| body  | text   | indexed stored |
| title | string |                |
+-------+--------+----------------+
3 rows in set (0.001 sec)
/cli_json
NOTE: The /cli_json endpoint is designed for manual interaction with Manticore using tools like curl or a browser. It is not intended for use in automated scripts. Use the /sql endpoint instead.

The /cli_json endpoint provides the same functionality as /cli, but the response format is JSON. It includes:

columns section describing the schema.
data section with the actual data.
Summary section with "total", "error", and "warning".


curl -X POST "http://localhost:3001/api/cli_json" -H "Content-Type: application/x-www-form-urlencoded" -d "SHOW TABLES" | head -10

Is the endpoint that actually handles sql cli commands , please update data provider to work with this info

/sql endpoint only supports SELECT queryies , INSERT
/cli_json should be used for everything else regarding data

-----------------------------------
Plain and real-time table settings
Defining table schema in a configuration file
table <table_name>[:<parent table name>] {
...
}
‹›
Plain
Real-time
📋
table <table name> {
  type = plain
  path = /path/to/table
  source = <source_name>
  source = <another source_name>
  [stored_fields = <comma separated list of full-text fields that should be stored, all are stored by default, can be empty>]
}
Common plain and real-time tables settings
type
type = plain

type = rt
Table type: "plain" or "rt" (real-time)

Value: plain (default), rt

path
path = path/to/table
The path to where the table will be stored or located, either absolute or relative, without the extension.

Value: The path to the table, mandatory

stored_fields
stored_fields = title, content
By default, the original content of full-text fields is indexed and stored when a table is defined in a configuration file. This setting allows you to specify the fields that should have their original values stored.

Value: A comma-separated list of full-text fields that should be stored. An empty value (i.e. stored_fields = ) disables the storage of original values for all fields.

Note: In the case of a real-time table, the fields listed in stored_fields should also be declared as rt_field.

Also, note that you don't need to list attributes in stored_fields, since their original values are stored anyway. stored_fields can only be used for full-text fields.

See also docstore_block_size, docstore_compression for document storage compression options.

‹›
SQL
JSON
PHP
Python
Python-asyncio
Javascript
Java
C#
Rust
Typescript
Go
CONFIG
📋
CREATE TABLE products(title text, content text stored indexed, name text indexed, price float)
stored_only_fields
stored_only_fields = title,content
Use stored_only_fields when you want Manticore to store some fields of a plain or real-time table on disk but not index them. These fields won't be searchable with full-text queries, but you can still retrieve their values in search results.

For example, this is useful if you want to store data like JSON documents that should be returned with each result, but don't need to be searched, filtered, or grouped. In that case, storing them only — and not indexing them — saves memory and improves performance.

You can do this in two ways:

In plain mode in a table config, use the stored_only_fields setting.
In the SQL interface (RT mode), use the stored property when defining a text field (instead of indexed or indexed stored). In SQL, you don't need to include stored_only_fields — it's not supported in CREATE TABLE statements.
The value of stored_only_fields is a comma-separated list of field names. By default, it's empty. If you're using a real-time table, each field listed in stored_only_fields must also be declared as an rt_field.

Note: you don't need to list attributes in stored_only_fields, since their original values are stored anyway.

How stored-only fields compare to string attributes:

Stored-only field:

Stored on disk only
Compressed format
Can only be retrieved (not used for filtering, sorting, etc.)
String attribute:

Stored on disk and in memory
Uncompressed format (unless you are using columnar storage)
Can be used for sorting, filtering, grouping, etc.
If you are looking to have Manticore store text data for you that you only want stored on disk (eg: json data that is returned with every result), and not in memory or searchable/filterable/groupable, use stored_only_fields, or stored as your text field property.

When creating your tables using the SQL interface, label your text field as stored (and not indexed or indexed stored). You will not need the stored_only_fields option in your CREATE TABLE statement; including it may result in a failed query.

json_secondary_indexes
json_secondary_indexes = json_attr
By default, secondary indexes are generated for all attributes except JSON attributes. However, secondary indexes for JSON attributes can be explicitly generated using the json_secondary_indexes setting. When a JSON attribute is included in this option, its contents are flattened into multiple secondary indexes. These indexes can be used by the query optimizer to speed up queries.

You can view the available secondary indexes using the SHOW TABLE INDEXES command.

Value: A comma-separated list of JSON attributes for which secondary indexes should be generated.

‹›
SQL
JSON
PHP
Python
Python-asyncio
Javascript
Java
C#
Rust
Typescript
Go
CONFIG
📋
CREATE TABLE products(title text, j json secondary_index='1')
Real-time table settings:
diskchunk_flush_search_timeout
diskchunk_flush_search_timeout = 10s
The timeout for preventing auto-flushing a RAM chunk if there are no searches in the table. Learn more here.

diskchunk_flush_write_timeout
diskchunk_flush_write_timeout = 60s
The timeout for auto-flushing a RAM chunk if there are no writes to it. Learn more here.

optimize_cutoff
The maximum number of disk chunks for the RT table. Learn more here.

rt_field
rt_field = subject
This field declaration determines the full-text fields that will be indexed. The field names must be unique, and the order is preserved. When inserting data, the field values must be in the same order as specified in the configuration.

This is a multi-value, optional field.

rt_attr_uint
rt_attr_uint = gid
This declaration defines an unsigned integer attribute.

Value: the field name or field_name:N (where N is the maximum number of bits to keep).

rt_attr_bigint
rt_attr_bigint = gid
This declaration defines a BIGINT attribute.

Value: field name, multiple records allowed.

rt_attr_multi
rt_attr_multi = tags
Declares a multi-valued attribute (MVA) with unsigned 32-bit integer values.

Value: field name. Multiple records allowed.

rt_attr_multi_64
rt_attr_multi_64 = wide_tags
Declares a multi-valued attribute (MVA) with signed 64-bit BIGINT values.

Value: field name. Multiple records allowed.

rt_attr_float
rt_attr_float = lat
rt_attr_float = lon
Declares floating point attributes with single precision, 32-bit IEEE 754 format.

Value: field name. Multiple records allowed.

rt_attr_float_vector
rt_attr_float_vector = image_vector
Declares a vector of floating-point values.

Value: field name. Multiple records allowed.

rt_attr_bool
rt_attr_bool = available
Declares a boolean attribute with 1-bit unsigned integer values.

Value: field name.

rt_attr_string
rt_attr_string = title
String attribute declaration.

Value: field name.

rt_attr_json
rt_attr_json = properties
Declares a JSON attribute.

Value: field name.

rt_attr_timestamp
rt_attr_timestamp = date_added
Declares a timestamp attribute.

Value: field name.

rt_mem_limit
rt_mem_limit = 512M
Memory limit for a RAM chunk of the table. Optional, default is 128M.

RT tables store some data in memory, known as the "RAM chunk", and also maintain a number of on-disk tables, referred to as "disk chunks." This directive allows you to control the size of the RAM chunk. When there is too much data to keep in memory, RT tables will flush it to disk, activate a newly created disk chunk, and reset the RAM chunk.

Please note that the limit is strict, and RT tables will never allocate more memory than what is specified in the rt_mem_limit. Additionally, memory is not preallocated, so specifying a 512MB limit and only inserting 3MB of data will result in allocating only 3MB, not 512MB.

The rt_mem_limit is never exceeded, but the actual RAM chunk size can be significantly lower than the limit. RT tables adapt to the data insertion pace and adjust the actual limit dynamically to minimize memory usage and maximize data write speed. This is how it works:

By default, the RAM chunk size is 50% of the rt_mem_limit, referred to as the "rt_mem_limit limit".
As soon as the RAM chunk accumulates data equivalent to rt_mem_limit * rate data (50% of rt_mem_limit by default), Manticore starts saving the RAM chunk as a new disk chunk.
While a new disk chunk is being saved, Manticore assesses the number of new/updated documents.
After saving a new disk chunk, the rt_mem_limit rate is updated.
The rate is reset to 50% each time you restart the searchd.
For instance, if 90MB of data is saved to a disk chunk and an additional 10MB of data arrives while the save is in progress, the rate would be 90%. Next time, the RT table will collect up to 90% of rt_mem_limit before flushing the data. The faster the insertion pace, the lower the rt_mem_limit rate. The rate varies between 33.3% to 95%. You can view the current rate of a table using the SHOW TABLE STATUS command.

How to change rt_mem_limit and optimize_cutoff
In real-time mode, you can adjust the size limit of RAM chunks and the maximum number of disk chunks using the ALTER TABLE statement. To set rt_mem_limit to 1 gigabyte for the table "t", run the following query: ALTER TABLE t rt_mem_limit='1G'. To change the maximum number of disk chunks, run the query: ALTER TABLE t optimize_cutoff='5'.

In the plain mode, you can change the values of rt_mem_limit and optimize_cutoff by updating the table configuration or running the command ALTER TABLE <table_name> RECONFIGURE

Important notes about RAM chunks
Real-time tables are similar to distributed consisting of multiple local tables, also known as disk chunks.
Each RAM chunk is made up of multiple segments, which are special RAM-only tables.
While disk chunks are stored on disk, RAM chunks are stored in memory.
Each transaction made to a real-time table generates a new segment, and RAM chunk segments are merged after each transaction commit. It is more efficient to perform bulk INSERTs of hundreds or thousands of documents rather than multiple separate INSERTs with one document to reduce the overhead from merging RAM chunk segments.
When the number of segments exceeds 32, they will be merged to keep the count below 32.
Real-time tables always have one RAM chunk (which may be empty) and one or more disk chunks.
Merging larger segments takes longer, so it's best to avoid having a very large RAM chunk (and therefore rt_mem_limit).
The number of disk chunks depends on the data in the table and the rt_mem_limit setting.
Searchd flushes the RAM chunk to disk (as a persisted file, not as a disk chunk) on shutdown and periodically according to the rt_flush_period setting. Flushing several gigabytes to disk may take some time.
A large RAM chunk puts more pressure on storage, both when flushing to disk into the .ram file and when the RAM chunk is full and dumped to disk as a disk chunk.
The RAM chunk is backed up by a binary log until it is flushed to disk, and a larger rt_mem_limit, setting will increase the time it takes to replay the binary log and recover the RAM chunk.
The RAM chunk may be slightly slower than a disk chunk.
Although the RAM chunk itself doesn't take up more memory than rt_mem_limit, Manticore may take up more memory in some cases, such as when you start a transaction to insert data and don't commit it for a while. In this case, the data you have already transmitted within the transaction will remain in memory.
RAM chunk flushing conditions
In addition to rt_mem_limit, the flushing behavior of RAM chunks is also influenced by the following options and conditions:

Frozen state. If the table is frozen, flushing is deferred. That is a permanent rule; nothing can override it. If the rt_mem_limit condition is reached while the table is frozen, all further inserts will be delayed until the table is unfrozen.

diskchunk_flush_write_timeout: This option defines the timeout (in seconds) for auto-flushing a RAM chunk if there are no writes to it. If no write occurs within this time, the chunk will be flushed to disk. Setting it to -1 disables auto-flushing based on write activity. The default value is 1 second.

diskchunk_flush_search_timeout: This option sets the timeout (in seconds) for preventing auto-flushing a RAM chunk if there are no searches in the table. Auto-flushing will only occur if there has been at least one search within this time. The default value is 30 seconds.

ongoing optimization: If an optimization process is currently running, and the number of existing disk chunks has reached or exceeded a configured internal cutoff threshold, the flush triggered by the diskchunk_flush_write_timeout or diskchunk_flush_search_timeout timeout will be skipped.

too few documents in RAM segments: If the number of documents across RAM segments is below a minimum threshold (8192), the flush triggered by the diskchunk_flush_write_timeout or diskchunk_flush_search_timeout timeout will be skipped to avoid creating very small disk chunks. This helps minimize unnecessary disk writes and chunk fragmentation.

These timeouts work in conjunction. A RAM chunk will be flushed if either timeout is reached. This ensures that even if there are no writes, the data will eventually be persisted to disk, and conversely, even if there are constant writes but no searches, the data will also be persisted. These settings provide more granular control over how frequently RAM chunks are flushed, balancing the need for data durability with performance considerations. Per-table directives for these settings have higher priority and will override the instance-wide defaults.

Plain table settings:
source
source = srcpart1
source = srcpart2
source = srcpart3
The source field specifies the source from which documents will be obtained during indexing of the current table. There must be at least one source. The sources can be of different types (e.g. one could be MySQL, another PostgreSQL). For more information on indexing from external storages, read here

Value: The name of the source is mandatory. Multiple values are allowed.

killlist_target
killlist_target = main:kl
This setting determines the table(s) to which the kill-list will be applied. Matches in the targeted table that are updated or deleted in the current table will be suppressed. In :kl mode, the documents to suppress are taken from the kill-list. In :id mode, all document IDs from the current table are suppressed in the targeted one. If neither is specified, both modes will take effect. Learn more about kill-lists here

Value: not specified (default), target_table_name:kl, target_table_name:id, target_table_name. Multiple values are allowed

columnar_attrs
columnar_attrs = *
columnar_attrs = id, attr1, attr2, attr3
This configuration setting determines which attributes should be stored in the columnar storage instead of the row-wise storage.

You can set columnar_attrs = * to store all supported data types in the columnar storage.

Additionally, id is a supported attribute to store in the columnar storage.

columnar_strings_no_hash
columnar_strings_no_hash = attr1, attr2, attr3
By default, all string attributes stored in columnar storage store pre-calculated hashes. These hashes are used for grouping and filtering. However, they occupy extra space, and if you don't need to group by that attribute, you can save space by disabling hash generation.

Creating a real-time table online via CREATE TABLE
General syntax of CREATE TABLE
CREATE TABLE [IF NOT EXISTS] name ( <field name> <field data type> [data type options] [, ...]) [table_options]
Data types:
For more information on data types, see more about data types here.

Type	Equivalent in a configuration file	Notes	Aliases
text	rt_field	Options: indexed, stored. Default: both. To keep text stored, but indexed, specify "stored" only. To keep text indexed only, specify "indexed" only.	string
integer	rt_attr_uint	integer	int, uint
bigint	rt_attr_bigint	big integer	
float	rt_attr_float	float	
float_vector	rt_attr_float_vector	a vector of float values	
multi	rt_attr_multi	multi-integer	
multi64	rt_attr_multi_64	multi-bigint	
bool	rt_attr_bool	boolean	
json	rt_attr_json	JSON	
string	rt_attr_string	string. Option indexed, attribute will make the value full-text indexed and filterable, sortable and groupable at the same time	
timestamp	rt_attr_timestamp	timestamp	
bit(n)	rt_attr_uint field_name:N	N is the max number of bits to keep	
‹›
SQL
📋
CREATE TABLE products (title text, price float) morphology='stem_en'
This creates the "products" table with two fields: "title" (full-text) and "price" (float), and sets the "morphology" to "stem_en".

CREATE TABLE products (title text indexed, description text stored, author text, price float)
This creates the "products" table with three fields:

"title" is indexed, but not stored.
"description" is stored, but not indexed.
"author" is both stored and indexed.
Engine
create table ... engine='columnar';
create table ... engine='rowwise';
The engine setting changes the default attribute storage for all attributes in the table. You can also specify engine separately for each attribute.

For information on how to enable columnar storage for a plain table, see columnar_attrs .

Values:

columnar - Enables columnar storage for all table attributes, except for json
rowwise (default) - Doesn't change anything and uses the traditional row-wise storage for the table.
Other settings
The following settings are applicable for both real-time and plain tables, regardless of whether they are specified in a configuration file or set online using the CREATE or ALTER command.

Performance related
Accessing table files
Manticore supports two access modes for reading table data: seek+read and mmap.

In seek+read mode, the server uses the pread system call to read document lists and keyword positions, represented by the *.spd and *.spp files. The server uses internal read buffers to optimize the reading process, and the size of these buffers can be adjusted using the options read_buffer_docs and read_buffer_hits.There is also the option preopen that controls how Manticore opens files at start.

In mmap access mode, the search server maps the table's file into memory using the mmap system call, and the OS caches the file contents. The options read_buffer_docs and read_buffer_hits have no effect for corresponding files in this mode. The mmap reader can also lock the table's data in memory using themlock privileged call, which prevents the OS from swapping the cached data out to disk.

To control which access mode to use, the options access_plain_attrs, access_blob_attrs, access_doclists, access_hitlists and access_dict are available, with the following values:

Value	Description
file	server reads the table files from disk with seek+read using internal buffers on file access
mmap	server maps the table files into memory and OS caches up its contents on file access
mmap_preread	server maps the table files into memory and a background thread reads it once to warm up the cache
mlock	server maps the table files into memory and then executes the mlock() system call to cache up the file contents and lock it into memory to prevent it being swapped out
Setting	Values	Description
access_plain_attrs	mmap, mmap_preread (default), mlock	controls how *.spa (plain attributes) *.spe (skip lists) *.spt (lookups) *.spm (killed docs) will be read
access_blob_attrs	mmap, mmap_preread (default), mlock	controls how *.spb (blob attributes) (string, mva and json attributes) will be read
access_doclists	file (default), mmap, mlock	controls how *.spd (doc lists) data will be read
access_hitlists	file (default), mmap, mlock	controls how *.spp (hit lists) data will be read
access_dict	mmap, mmap_preread (default), mlock	controls how *.spi (dictionary) will be read
Here is a table which can help you select your desired mode:

table part	keep it on disk	keep it in memory	cached in memory on server start	lock it in memory
plain attributes in row-wise (non-columnar) storage, skip lists, word lists, lookups, killed docs	mmap	mmap	mmap_preread (default)	mlock
row-wise string, multi-value attributes (MVA) and json attributes	mmap	mmap	mmap_preread (default)	mlock
columnar numeric, string and multi-value attributes	always	only by means of OS	no	not supported
doc lists	file (default)	mmap	no	mlock
hit lists	file (default)	mmap	no	mlock
dictionary	mmap	mmap	mmap_preread (default)	mlock
The recommendations are:
For the fastest search response time and ample memory availability, use row-wise attributes and lock them in memory using mlock. Additionally, use mlock for doclists/hitlists.
If you prioritize can't afford lower performance after start and are willing to accept longer startup time, use the --force-preread. option. If you desire faster searchd restart, stick to the default mmap_preread option.
If you are looking to conserve memory, while still having enough memory for all attributes, skip the use of mlock. The operating system will determine what should be kept in memory based on frequent disk reads.
If row-wise attributes do not fit into memory, opt for columnar attributes
If full-text search performance is not a concern, and you wish to save memory, use access_doclists/access_hitlists=file
The default mode offers a balance of:

mmap,
Prereading non-columnar attributes,
Seeking and reading columnar attributes with no preread,
Seeking and reading doclists/hitlists with no preread.
This provides a decent search performance, optimal memory utilization, and faster searchd restart in most scenarios.

Other performance related settings
attr_update_reserve
attr_update_reserve = 256k
This setting reserves extra space for updates to blob attributes such as multi-value attributes (MVA), strings, and JSON. The default value is 128k. When updating these attributes, their length may change. If the updated string is shorter than the previous one, it will overwrite the old data in the *.spb file. If the updated string is longer, it will be written to the end of the *.spb file. This file is memory-mapped, making resizing it a potentially slow process, depending on the operating system's memory-mapped file implementation. To avoid frequent resizing, you can use this setting to reserve extra space at the end of the .spb file.

Value: size, default 128k.

docstore_block_size
docstore_block_size = 32k
This setting controls the size of blocks used by the document storage. The default value is 16kb. When original document text is stored using stored_fields or stored_only_fields, it is stored within the table and compressed for efficiency. To optimize disk access and compression ratios for small documents, these documents are concatenated into blocks. The indexing process collects documents until their total size reaches the threshold specified by this option. At that point, the block of documents is compressed. This option can be adjusted to achieve better compression ratios (by increasing the block size) or faster access to document text (by decreasing the block size).

Value: size, default 16k.

docstore_compression
docstore_compression = lz4hc
This setting determines the type of compression used for compressing blocks of documents stored in document storage. If stored_fields or stored_only_fields are specified, the document storage stores compressed document blocks. 'lz4' offers fast compression and decompression speeds, while 'lz4hc' (high compression) sacrifices some compression speed for a better compression ratio. 'none' disables compression completely.

Values: lz4 (default), lz4hc, none.

docstore_compression_level
docstore_compression_level = 12
The compression level used when 'lz4hc' compression is applied in document storage. By adjusting the compression level, you can find the right balance between performance and compression ratio when using 'lz4hc' compression. Note that this option is not applicable when using 'lz4' compression.

Value: An integer between 1 and 12, with a default of 9.

preopen
preopen = 1
This setting indicates that searchd should open all table files on startup or rotation, and keep them open while running. By default, the files are not pre-opened. Pre-opened tables require a few file descriptors per table, but they eliminate the need for per-query open() calls and are immune to race conditions that might occur during table rotation under high load. However, if you are serving many tables, it may still be more efficient to open them on a per-query basis in order to conserve file descriptors.

Value: 0 (default), or 1.

read_buffer_docs
read_buffer_docs = 1M
Buffer size for storing the list of documents per keyword. Increasing this value will result in higher memory usage during query execution, but may reduce I/O time.

Value: size, default 256k, minimum value is 8k.

read_buffer_hits
read_buffer_hits = 1M
Buffer size for storing the list of hits per keyword. Increasing this value will result in higher memory usage during query execution, but may reduce I/O time.

Value: size, default 256k, minimum value is 8k.

Plain table disk footprint settings
inplace_enable
inplace_enable = {0|1}
Enables in-place table inversion. Optional, default is 0 (uses separate temporary files).

The inplace_enable option reduces the disk footprint during indexing of plain tables, while slightly slowing down indexing (it uses approximately 2 times less disk, but yields around 90-95% of the original performance).

Indexing is comprised of two primary phases. During the first phase, documents are collected, processed, and partially sorted by keyword, and the intermediate results are written to temporary files (.tmp*). During the second phase, the documents are fully sorted and the final table files are created. Rebuilding a production table on-the-fly requires approximately 3 times the peak disk footprint: first for the intermediate temporary files, second for the newly constructed copy, and third for the old table that will be serving production queries in the meantime. (Intermediate data is comparable in size to the final table.) This may be too much disk footprint for large data collections, and the inplace_enable option can be used to reduce it. When enabled, it reuses the temporary files, outputs the final data back to them, and renames them upon completion. However, this may require additional temporary data chunk relocation, which is where the performance impact comes from.

This directive has no effect on searchd, it only affects the indexer.

‹›
CONFIG
📋
table products {
  inplace_enable = 1

  path = products
  source = src_base
}
inplace_hit_gap
inplace_hit_gap = size
The option In-place inversion fine-tuning option. Controls preallocated hitlist gap size. Optional, default is 0.

This directive only affects the searchd tool, and does not have any impact on the indexer.

‹›
CONFIG
📋
table products {
  inplace_hit_gap = 1M
  inplace_enable = 1

  path = products
  source = src_base
}
inplace_reloc_factor
inplace_reloc_factor = 0.1
The inplace_reloc_factor setting determines the size of the relocation buffer within the memory arena used during indexing. The default value is 0.1.

This option is optional and only affects the indexer tool, not the searchd server.

‹›
CONFIG
📋
table products {
  inplace_reloc_factor = 0.1
  inplace_enable = 1

  path = products
  source = src_base
}
inplace_write_factor
inplace_write_factor = 0.1
Controls the size of the buffer used for in-place writing during indexing. Optional, with a default value of 0.1.

It's important to note that this directive only impacts the indexer tool and not the searchd server.

‹›
CONFIG
📋
table products {
  inplace_write_factor = 0.1
  inplace_enable = 1

  path = products
  source = src_base
}
Natural language processing specific settings
The following settings are supported. They are all described in section NLP and tokenization.

bigram_freq_words
bigram_index
blend_chars
blend_mode
charset_table
dict
embedded_limit
exceptions
expand_keywords
global_idf
hitless_words
html_index_attrs
html_remove_elements
html_strip
ignore_chars
index_exact_words
index_field_lengths
index_sp
index_token_filter
index_zones
infix_fields
killlist_target
max_substring_len
min_infix_len
min_prefix_len
min_stemming_len
min_word_len
morphology
morphology_skip_fields
ngram_chars
ngram_len
overshort_step
phrase_boundary
phrase_boundary_step
prefix_fields
regexp_filter
stopwords
stopword_step
stopwords_unstemmed
stored_fields
stored_only_fields
wordforms