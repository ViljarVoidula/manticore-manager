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