Faceted search is as crucial to a modern search application as autocomplete, spell correction, and search keywords highlighting, especially in e-commerce products.

Faceted search

Faceted search comes in handy when dealing with large quantities of data and various interconnected properties, such as size, color, manufacturer, or other factors. When querying vast amounts of data, search results frequently include numerous entries that don't match the user's expectations. Faceted search enables the end user to explicitly define the criteria they want their search results to satisfy.

In Manticore Search, there's an optimization that maintains the result set of the original query and reuses it for each facet calculation. Since the aggregations are applied to an already calculated subset of documents, they're fast, and the total execution time can often be only slightly longer than the initial query. Facets can be added to any query, and the facet can be any attribute or expression. A facet result includes the facet values and the facet counts. Facets can be accessed using the SQL SELECT statement by declaring them at the very end of the query.

Aggregations
SQL
The facet values can originate from an attribute, a JSON property within a JSON attribute, or an expression. Facet values can also be aliased, but the alias must be unique across all result sets (main query result set and other facets result sets). The facet value is derived from the aggregated attribute/expression, but it can also come from another attribute/expression.

FACET {expr_list} [BY {expr_list} ] [DISTINCT {field_name}] [ORDER BY {expr | FACET()} {ASC | DESC}] [LIMIT [offset,] count] 
Multiple facet declarations must be separated by a whitespace.

HTTP JSON
Facets can be defined in the aggs node:

     "aggs" :
     {
        "group name" :
         {
            "terms" :
             {
              "field":"attribute name",
              "size": 1000
             }
             "sort": [ {"attribute name": { "order":"asc" }} ]
         }
     } 
where:

group name is an alias assigned to the aggregation
field value must contain the name of the attribute or expression being faceted
optional size specifies the maximum number of buckets to include in the result. When not specified, it inherits the main query's limit. More details can be found in the Size of facet result section.
optional sort specifies an array of attributes and/or additional properties using the same syntax as the "sort" parameter in the main query.
The result set will contain an aggregations node with the returned facets, where key is the aggregated value and doc_count is the aggregation count.

    "aggregations": {
        "group name": {
        "buckets": [
            {
                "key": 10,
                "doc_count": 1019
            },
            {
                "key": 9,
                "doc_count": 954
            },
            {
                "key": 8,
                "doc_count": 1021
            },
            {
                "key": 7,
                "doc_count": 1011
            },
            {
                "key": 6,
                "doc_count": 997
            }
            ]
        }
    }    
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
TypeScript
Go
📋
SELECT *, price AS aprice FROM facetdemo LIMIT 10 FACET price LIMIT 10 FACET brand_id LIMIT 5; 
‹›
Response
+------+-------+----------+---------------------+------------+-------------+---------------------------------------+------------+--------+
| id   | price | brand_id | title               | brand_name | property    | j                                     | categories | aprice |
+------+-------+----------+---------------------+------------+-------------+---------------------------------------+------------+--------+
|    1 |   306 |        1 | Product Ten Three   | Brand One  | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |    306 |
|    2 |   400 |       10 | Product Three One   | Brand Ten  | Four_Three  | {"prop1":69,"prop2":19,"prop3":"One"} | 13,14      |    400 |
...
|    9 |   560 |        6 | Product Two Five    | Brand Six  | Eight_Two   | {"prop1":90,"prop2":84,"prop3":"One"} | 13,14      |    560 |
|   10 |   229 |        9 | Product Three Eight | Brand Nine | Seven_Three | {"prop1":84,"prop2":39,"prop3":"One"} | 12,13      |    229 |
+------+-------+----------+---------------------+------------+-------------+---------------------------------------+------------+--------+
10 rows in set (0.00 sec)
+-------+----------+
| price | count(*) |
+-------+----------+
|   306 |        7 |
|   400 |       13 |
...
|   229 |        9 |
|   595 |       10 |
+-------+----------+
10 rows in set (0.00 sec)
+----------+----------+
| brand_id | count(*) |
+----------+----------+
|        1 |     1013 |
|       10 |      998 |
|        5 |     1007 |
|        8 |     1033 |
|        7 |      965 |
+----------+----------+
5 rows in set (0.00 sec) 
Faceting by aggregation over another attribute
Data can be faceted by aggregating another attribute or expression. For example if the documents contain both the brand id and name, we can return in facet the brand names, but aggregate the brand ids. This can be done by using FACET {expr1} BY {expr2}

‹›
SQL
📋
SELECT * FROM facetdemo FACET brand_name by brand_id; 
‹›
Response
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
| id   | price | brand_id | title               | brand_name  | property    | j                                     | categories |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
|    1 |   306 |        1 | Product Ten Three   | Brand One   | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |
|    2 |   400 |       10 | Product Three One   | Brand Ten   | Four_Three  | {"prop1":69,"prop2":19,"prop3":"One"} | 13,14      |
....
|   19 |   855 |        1 | Product Seven Two   | Brand One   | Eight_Seven | {"prop1":63,"prop2":78,"prop3":"One"} | 10,11,12   |
|   20 |    31 |        9 | Product Four One    | Brand Nine  | Ten_Four    | {"prop1":79,"prop2":42,"prop3":"One"} | 12,13,14   |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
20 rows in set (0.00 sec)
+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand One   |     1013 |
| Brand Ten   |      998 |
| Brand Five  |     1007 |
| Brand Nine  |      944 |
| Brand Two   |      990 |
| Brand Six   |     1039 |
| Brand Three |     1016 |
| Brand Four  |      994 |
| Brand Eight |     1033 |
| Brand Seven |      965 |
+-------------+----------+
10 rows in set (0.00 sec) 
Faceting without duplicates
If you need to remove duplicates from the buckets returned by FACET, you can use DISTINCT field_name , where field_name is the field by which you want to perform deduplication. It can also be id (which is the default) if you make a FACET query against a distributed table and are not sure whether you have unique ids in the tables (the tables should be local and have the same schema).

If you have multiple FACET declarations in your query, field_name should be the same in all of them.

DISTINCT returns an additional column count(distinct ...) before the column count(*) , allowing you to obtain both results without needing to make another query.

‹›
SQL
JSON
📋
SELECT brand_name, property FROM facetdemo FACET brand_name distinct property; 
‹›
Response
+-------------+----------+
| brand_name  | property |
+-------------+----------+
| Brand Nine  | Four     |
| Brand Ten   | Four     |
| Brand One   | Five     |
| Brand Seven | Nine     |
| Brand Seven | Seven    |
| Brand Three | Seven    |
| Brand Nine  | Five     |
| Brand Three | Eight    |
| Brand Two   | Eight    |
| Brand Six   | Eight    |
| Brand Ten   | Four     |
| Brand Ten   | Two      |
| Brand Four  | Ten      |
| Brand One   | Nine     |
| Brand Four  | Eight    |
| Brand Nine  | Seven    |
| Brand Four  | Five     |
| Brand Three | Four     |
| Brand Four  | Two      |
| Brand Four  | Eight    |
+-------------+----------+
20 rows in set (0.00 sec)

+-------------+--------------------------+----------+
| brand_name  | count(distinct property) | count(*) |
+-------------+--------------------------+----------+
| Brand Nine  |                        3 |        3 |
| Brand Ten   |                        2 |        3 |
| Brand One   |                        2 |        2 |
| Brand Seven |                        2 |        2 |
| Brand Three |                        3 |        3 |
| Brand Two   |                        1 |        1 |
| Brand Six   |                        1 |        1 |
| Brand Four  |                        4 |        5 |
+-------------+--------------------------+----------+
8 rows in set (0.00 sec) 
Facet over expressions
Facets can aggregate over expressions. A classic example is the segmentation of prices by specific ranges:

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
TypeScript
Go
📋
SELECT * FROM facetdemo FACET INTERVAL(price,200,400,600,800) AS price_range ; 
‹›
Response
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
| id   | price | brand_id | title               | brand_name  | property    | j                                     | categories | price_range |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
|    1 |   306 |        1 | Product Ten Three   | Brand One   | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |           1 |
...
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
20 rows in set (0.00 sec)

+-------------+----------+
| price_range | count(*) |
+-------------+----------+
|           0 |     1885 |
|           3 |     1973 |
|           4 |     2100 |
|           2 |     1999 |
|           1 |     2043 |
+-------------+----------+
5 rows in set (0.01 sec) 
Facet over multi-level grouping
Facets can aggregate over multi-level grouping, with the result set being the same as if the query performed a multi-level grouping:

‹›
SQL
📋
SELECT *,INTERVAL(price,200,400,600,800) AS price_range FROM facetdemo
FACET price_range AS price_range,brand_name ORDER BY brand_name asc; 
‹›
Response
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
| id   | price | brand_id | title               | brand_name  | property    | j                                     | categories | price_range |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
|    1 |   306 |        1 | Product Ten Three   | Brand One   | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |           1 |
...
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+-------------+
20 rows in set (0.00 sec)

+--------------+-------------+----------+
| fprice_range | brand_name  | count(*) |
+--------------+-------------+----------+
|            1 | Brand Eight |      197 |
|            4 | Brand Eight |      235 |
|            3 | Brand Eight |      203 |
|            2 | Brand Eight |      201 |
|            0 | Brand Eight |      197 |
|            4 | Brand Five  |      230 |
|            2 | Brand Five  |      197 |
|            1 | Brand Five  |      204 |
|            3 | Brand Five  |      193 |
|            0 | Brand Five  |      183 |
|            1 | Brand Four  |      195 |
... 
Facet over histogram values
Facets can aggregate over histogram values by constructing fixed-size buckets over the values. The key function is:

key_of_the_bucket = interval + offset * floor ( ( value - offset ) / interval ) 
The histogram argument interval must be positive, and the histogram argument offset must be positive and less than interval . By default, the buckets are returned as an array. The histogram argument keyed makes the response a dictionary with the bucket keys.

‹›
SQL
JSON
JSON 2
📋
SELECT COUNT(*), HISTOGRAM(price, {hist_interval=100}) as price_range FROM facets GROUP BY price_range ORDER BY price_range ASC; 
‹›
Response
+----------+-------------+
| count(*) | price_range |
+----------+-------------+
|        5 |           0 |
|        5 |         100 |
|        1 |         300 |
|        4 |         400 |
|        1 |         500 |
|        3 |         700 |
|        1 |         900 |
+----------+-------------+ 
Facet over histogram date values
Facets can aggregate over histogram date values, which is similar to the normal histogram. The difference is that the interval is specified using a date or time expression. Such expressions require special support because the intervals are not always of fixed length. Values are rounded to the closest bucket using the following key function:

key_of_the_bucket = interval * floor ( value / interval ) 
The histogram parameter calendar_interval understands months to have different amounts of days. Unlike calendar_interval , the fixed_interval parameter uses a fixed number of units and does not deviate, regardless of where it falls on the calendar. However fixed_interval cannot process units such as months because a month is not a fixed quantity. Attempting to specify units like weeks or months for fixed_interval will result in an error. The accepted intervals are described in the date_histogram expression. By default, the buckets are returned as an array. The histogram argument keyed makes the response a dictionary with the bucket keys.

‹›
SQL
JSON
📋
SELECT count(*), DATE_HISTOGRAM(tm, {calendar_interval='month'}) AS months FROM idx_dates GROUP BY months ORDER BY months ASC 
‹›
Response
+----------+------------+
| count(*) | months     |
+----------+------------+
|      442 | 1485907200 |
|      744 | 1488326400 |
|      720 | 1491004800 |
|      230 | 1493596800 |
+----------+------------+ 
Facet over set of ranges
Facets can aggregate over a set of ranges. The values are checked against the bucket range, where each bucket includes the from value and excludes the to value from the range. Setting the keyed property to true makes the response a dictionary with the bucket keys rather than an array.

‹›
SQL
JSON
JSON 2
📋
SELECT COUNT(*), RANGE(price, {range_to=150},{range_from=150,range_to=300},{range_from=300}) price_range FROM facets GROUP BY price_range ORDER BY price_range ASC; 
‹›
Response
+----------+-------------+
| count(*) | price_range |
+----------+-------------+
|        8 |           0 |
|        2 |           1 |
|       10 |           2 |
+----------+-------------+ 
Facet over set of date ranges
Facets can aggregate over a set of date ranges, which is similar to the normal range. The difference is that the from and to values can be expressed in Date math expressions. This aggregation includes the from value and excludes the to value for each range. Setting the keyed property to true makes the response a dictionary with the bucket keys rather than an array.

‹›
SQL
JSON
📋
SELECT COUNT(*), DATE_RANGE(tm, {range_to='2017||+2M/M'},{range_from='2017||+2M/M',range_to='2017||+5M/M'},{range_from='2017||+5M/M'}) AS points FROM idx_dates GROUP BY points ORDER BY points ASC; 
‹›
Response
+----------+--------+
| count(*) | points |
+----------+--------+
|      442 |      0 |
|     1464 |      1 |
|      230 |      2 |
+----------+--------+ 
Ordering in facet result
Facets support the ORDER BY clause just like a standard query. Each facet can have its own ordering, and the facet ordering doesn't affect the main result set's ordering, which is determined by the main query's ORDER BY . Sorting can be done on attribute name, count (using COUNT(*) , COUNT(DISTINCT attribute_name) ), or the special FACET() function, which provides the aggregated data values. By default, a query with ORDER BY COUNT(*) will sort in descending order.

‹›
SQL
JSON
📋
SELECT * FROM facetdemo
FACET brand_name BY brand_id ORDER BY FACET() ASC
FACET brand_name BY brand_id ORDER BY brand_name ASC
FACET brand_name BY brand_id order BY COUNT(*) DESC;
FACET brand_name BY brand_id order BY COUNT(*); 
‹›
Response
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
| id   | price | brand_id | title               | brand_name  | property    | j                                     | categories |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
|    1 |   306 |        1 | Product Ten Three   | Brand One   | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |
...
|   20 |    31 |        9 | Product Four One    | Brand Nine  | Ten_Four    | {"prop1":79,"prop2":42,"prop3":"One"} | 12,13,14   |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
20 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand One   |     1013 |
| Brand Two   |      990 |
| Brand Three |     1016 |
| Brand Four  |      994 |
| Brand Five  |     1007 |
| Brand Six   |     1039 |
| Brand Seven |      965 |
| Brand Eight |     1033 |
| Brand Nine  |      944 |
| Brand Ten   |      998 |
+-------------+----------+
10 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand Eight |     1033 |
| Brand Five  |     1007 |
| Brand Four  |      994 |
| Brand Nine  |      944 |
| Brand One   |     1013 |
| Brand Seven |      965 |
| Brand Six   |     1039 |
| Brand Ten   |      998 |
| Brand Three |     1016 |
| Brand Two   |      990 |
+-------------+----------+
10 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand Six   |     1039 |
| Brand Eight |     1033 |
| Brand Three |     1016 |
| Brand One   |     1013 |
| Brand Five  |     1007 |
| Brand Ten   |      998 |
| Brand Four  |      994 |
| Brand Two   |      990 |
| Brand Seven |      965 |
| Brand Nine  |      944 |
+-------------+----------+
10 rows in set (0.01 sec) 
Size of facet result
By default, each facet result set is limited to 20 values. The number of facet values can be controlled with the LIMIT clause individually for each facet by providing either a number of values to return in the format LIMIT count or with an offset as LIMIT offset, count .

The maximum facet values that can be returned is limited by the query's max_matches setting. If you want to implement dynamic max_matches (limiting max_matches to offset + per page for better performance), it must be taken into account that a too low max_matches value can affect the number of facet values. In this case, a minimum max_matches value should be used that is sufficient to cover the number of facet values.

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
TypeScript
Go
📋
SELECT * FROM facetdemo
FACET brand_name BY brand_id ORDER BY FACET() ASC  LIMIT 0,1
FACET brand_name BY brand_id ORDER BY brand_name ASC LIMIT 2,4
FACET brand_name BY brand_id order BY COUNT(*) DESC LIMIT 4; 
‹›
Response
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
| id   | price | brand_id | title               | brand_name  | property    | j                                     | categories |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
|    1 |   306 |        1 | Product Ten Three   | Brand One   | Six_Ten     | {"prop1":66,"prop2":91,"prop3":"One"} | 10,11      |
...
|   20 |    31 |        9 | Product Four One    | Brand Nine  | Ten_Four    | {"prop1":79,"prop2":42,"prop3":"One"} | 12,13,14   |
+------+-------+----------+---------------------+-------------+-------------+---------------------------------------+------------+
20 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand One   |     1013 |

+-------------+----------+
1 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |

+-------------+----------+
| Brand Four  |      994 |
| Brand Nine  |      944 |
| Brand One   |     1013 |
| Brand Seven |      965 |

+-------------+----------+
4 rows in set (0.01 sec)

+-------------+----------+
| brand_name  | count(*) |
+-------------+----------+
| Brand Six   |     1039 |
| Brand Eight |     1033 |
| Brand Three |     1016 |
+-------------+----------+
3 rows in set (0.01 sec) 
Returned result set
When using SQL, a search with facets returns multiple result sets. The MySQL client/library/connector used must support multiple result sets in order to access the facet result sets.

Performance
Internally, the FACET is a shorthand for executing a multi-query where the first query contains the main search query and the rest of the queries in the batch have each a clustering. As in the case of multi-query, the common query optimization can kick in for a faceted search, meaning the search query is executed only once, and the facets operate on the search query result, with each facet adding only a fraction of time to the total query time.

To check if the faceted search ran in an optimized mode, you can look in the query log, where all logged queries will contain an xN string, where N is the number of queries that ran in the optimized group. Alternatively, you can check the output of the SHOW META statement, which will display a multiplier metric:



----------------------_-------------------

Sorting and ranking
Query results can be sorted by full-text ranking weight, one or more attributes or expressions.

Full-text queries return matches sorted by default. If nothing is specified, they are sorted by relevance, which is equivalent to ORDER BY weight() DESC in SQL format.

Non-full-text queries do not perform any sorting by default.

Advanced sorting
Extended mode is automatically enabled when you explicitly provide sorting rules by adding the ORDER BY clause in SQL format or using the sort option via HTTP JSON.

Sorting via SQL
General syntax:

SELECT ... ORDER BY
{attribute_name | expr_alias | weight() | random() } [ASC | DESC],
...
{attribute_name | expr_alias | weight() | random() } [ASC | DESC]
In the sort clause, you can use any combination of up to 5 columns, each followed by asc or desc. Functions and expressions are not allowed as arguments for the sort clause, except for the weight() and random() functions (the latter can only be used via SQL in the form of ORDER BY random()). However, you can use any expression in the SELECT list and sort by its alias.

‹›
SQL
📋
select *, a + b alias from test order by alias desc;
‹›
Response
+------+------+------+----------+-------+
| id   | a    | b    | f        | alias |
+------+------+------+----------+-------+
|    1 |    2 |    3 | document |     5 |
+------+------+------+----------+-------+
Sorting via JSON
"sort" specifies an array where each element can be an attribute name or _score if you want to sort by match weights or _random if you want radnom match order. In that case, the sort order defaults to ascending for attributes and descending for _score.

‹›
JSON
PHP
Python
Python-asyncio
javascript
Java
C#
Rust
typescript
go
📋
⚙
{
  "table":"test",
  "query":
  {
    "match": { "title": "Test document" }
  },
  "sort": [ "_score", "id" ],
  "_source": "title",
  "limit": 3
}
‹›
Response
    {
      "took": 0,
      "timed_out": false,
      "hits": {
        "total": 5,
        "total_relation": "eq",
        "hits": [
          {
            "_id": 5406864699109146628,
            "_score": 2319,
            "_source": {
              "title": "Test document 1"
            }
          },
          {
            "_id": 5406864699109146629,
            "_score": 2319,
            "_source": {
              "title": "Test document 2"
            }
          },
          {
            "_id": 5406864699109146630,
            "_score": 2319,
            "_source": {
              "title": "Test document 3"
            }
          }
        ]
      }
    }
You can also specify the sort order explicitly:

asc: sort in ascending order
desc: sort in descending order
‹›
JSON
PHP
Python
Python-asyncio
javascript
Java
C#
Rust
typescript
go
📋
⚙
{
  "table":"test",
  "query":
  {
    "match": { "title": "Test document" }
  },
  "sort":
  [
    { "id": "desc" },
    "_score"
  ],
  "_source": "title",
  "limit": 3
}
‹›
Response
    {
      "took": 0,
      "timed_out": false,
      "hits": {
        "total": 5,
        "total_relation": "eq",
        "hits": [
          {
            "_id": 5406864699109146632,
            "_score": 2319,
            "_source": {
              "title": "Test document 5"
            }
          },
          {
            "_id": 5406864699109146631,
            "_score": 2319,
            "_source": {
              "title": "Test document 4"
            }
          },
          {
            "_id": 5406864699109146630,
            "_score": 2319,
            "_source": {
              "title": "Test document 3"
            }
          }
        ]
      }
    }
You can also use another syntax and specify the sort order via the order property:

‹›
JSON
PHP
Python
Python-asyncio
javascript
Java
C#
Rust
typescript
go
📋
⚙
{
  "table":"test",
  "query":
  {
    "match": { "title": "Test document" }
  },
  "sort":
  [
    { "id": { "order":"desc" } }
  ],
  "_source": "title",
  "limit": 3
}
‹›
Response
    {
      "took": 0,
      "timed_out": false,
      "hits": {
        "total": 5,
        "total_relation": "eq",
        "hits": [
          {
            "_id": 5406864699109146632,
            "_score": 2319,
            "_source": {
              "title": "Test document 5"
            }
          },
          {
            "_id": 5406864699109146631,
            "_score": 2319,
            "_source": {
              "title": "Test document 4"
            }
          },
          {
            "_id": 5406864699109146630,
            "_score": 2319,
            "_source": {
              "title": "Test document 3"
            }
          }
        ]
      }
    }
Sorting by MVA attributes is also supported in JSON queries. Sorting mode can be set via the mode property. The following modes are supported:

min: sort by minimum value
max: sort by maximum value
‹›
JSON
PHP
Python
Python-asyncio
javascript
Java
C#
Rust
typescript
go
📋
⚙
{
  "table":"test",
  "query":
  {
    "match": { "title": "Test document" }
  },
  "sort":
  [
    { "attr_mva": { "order":"desc", "mode":"max" } }
  ],
  "_source": "title",
  "limit": 3
}
‹›
Response
    {
      "took": 0,
      "timed_out": false,
      "hits": {
        "total": 5,
        "total_relation": "eq",
        "hits": [
          {
            "_id": 5406864699109146631,
            "_score": 2319,
            "_source": {
              "title": "Test document 4"
            }
          },
          {
            "_id": 5406864699109146629,
            "_score": 2319,
            "_source": {
              "title": "Test document 2"
            }
          },
          {
            "_id": 5406864699109146628,
            "_score": 2319,
            "_source": {
              "title": "Test document 1"
            }
          }
        ]
      }
    }
When sorting on an attribute, match weight (score) calculation is disabled by default (no ranker is used). You can enable weight calculation by setting the track_scores property to true:

‹›
JSON
PHP
Python
Python-asyncio
javascript
Java
C#
Rust
typescript
go
📋
⚙
{
  "table":"test",
  "track_scores": true,
  "query":
  {
    "match": { "title": "Test document" }
  },
  "sort":
  [
    { "attr_mva": { "order":"desc", "mode":"max" } }
  ],
  "_source": "title",
  "limit": 3
}
‹›
Response
    {
      "took": 0,
      "timed_out": false,
      "hits": {
        "total": 5,
        "total_relation": "eq",
        "hits": [
          {
            "_id": 5406864699109146631,
            "_score": 2319,
            "_source": {
              "title": "Test document 4"
            }
          },
          {
            "_id": 5406864699109146629,
            "_score": 2319,
            "_source": {
              "title": "Test document 2"
            }
          },
          {
            "_id": 5406864699109146628,
            "_score": 2319,
            "_source": {
              "title": "Test document 1"
            }
          }
        ]
      }
    }
Ranking overview
Ranking (also known as weighting) of search results can be defined as a process of computing a so-called relevance (weight) for every given matched document regards to a given query that matched it. So relevance is, in the end, just a number attached to every document that estimates how relevant the document is to the query. Search results can then be sorted based on this number and/or some additional parameters, so that the most sought-after results would appear higher on the results page.

There is no single standard one-size-fits-all way to rank any document in any scenario. Moreover, there can never be such a way, because relevance is subjective. As in, what seems relevant to you might not seem relevant to me. Hence, in general cases, it's not just hard to compute; it's theoretically impossible.

So ranking in Manticore is configurable. It has a notion of a so-called ranker. A ranker can formally be defined as a function that takes a document and a query as its input and produces a relevance value as output. In layman's terms, a ranker controls exactly how (using which specific algorithm) Manticore will assign weights to the documents.

Available built-in rankers
Manticore ships with several built-in rankers suited for different purposes. Many of them use two factors: phrase proximity (also known as LCS) and BM25. Phrase proximity works on keyword positions, while BM25 works on keyword frequencies. Essentially, the better the degree of phrase match between the document body and the query, the higher the phrase proximity (it maxes out when the document contains the entire query as a verbatim quote). And BM25 is higher when the document contains more rare words. We'll save the detailed discussion for later.

The currently implemented rankers are:

proximity_bm25, the default ranking mode that uses and combines both phrase proximity and BM25 ranking.
bm25, a statistical ranking mode that uses BM25 ranking only (similar to most other full-text engines). This mode is faster but may result in worse quality for queries containing more than one keyword.
none, a no-ranking mode. This mode is obviously the fastest. A weight of 1 is assigned to all matches. This is sometimes called boolean searching, which just matches the documents but does not rank them.
wordcount, ranking by the keyword occurrences count. This ranker computes the per-field keyword occurrence counts, then multiplies them by field weights, and sums the resulting values.
proximity returns the raw phrase proximity value as a result. This mode is internally used to emulate SPH_MATCH_ALL queries.
matchany returns rank as it was computed in SPH_MATCH_ANY mode earlier and is internally used to emulate SPH_MATCH_ANY queries.
fieldmask returns a 32-bit mask with the N-th bit corresponding to the N-th full-text field, numbering from 0. The bit will only be set when the respective field has any keyword occurrences satisfying the query.
sph04 is generally based on the default 'proximity_bm25' ranker, but additionally boosts matches when they occur at the very beginning or the very end of a text field. Thus, if a field equals the exact query, sph04 should rank it higher than a field that contains the exact query but is not equal to it. (For instance, when the query is "Hyde Park", a document titled "Hyde Park" should be ranked higher than one titled "Hyde Park, London" or "The Hyde Park Cafe".)
expr allows you to specify the ranking formula at runtime. It exposes several internal text factors and lets you define how the final weight should be computed from those factors. You can find more details about its syntax and a reference of available factors in a subsection below.
The ranker name is case-insensitive. Example:

SELECT ... OPTION ranker=sph04;
Quick summary of the ranking factors
Name	Level	Type	Summary
max_lcs	query	int	maximum possible LCS value for the current query
bm25	document	int	quick estimate of BM25(1.2, 0)
bm25a(k1, b)	document	int	precise BM25() value with configurable K1, B constants and syntax support
bm25f(k1, b, {field=weight, ...})	document	int	precise BM25F() value with extra configurable field weights
field_mask	document	int	bit mask of matched fields
query_word_count	document	int	number of unique inclusive keywords in a query
doc_word_count	document	int	number of unique keywords matched in the document
lcs	field	int	Longest Common Subsequence between query and document, in words
user_weight	field	int	user field weight
hit_count	field	int	total number of keyword occurrences
word_count	field	int	number of unique matched keywords
tf_idf	field	float	sum(tf*idf) over matched keywords == sum(idf) over occurrences
min_hit_pos	field	int	first matched occurrence position, in words, 1-based
min_best_span_pos	field	int	first maximum LCS span position, in words, 1-based
exact_hit	field	bool	whether query == field
min_idf	field	float	min(idf) over matched keywords
max_idf	field	float	max(idf) over matched keywords
sum_idf	field	float	sum(idf) over matched keywords
exact_order	field	bool	whether all query keywords were a) matched and b) in query order
min_gaps	field	int	minimum number of gaps between the matched keywords over the matching spans
lccs	field	int	Longest Common Contiguous Subsequence between query and document, in words
wlccs	field	float	Weighted Longest Common Contiguous Subsequence, sum(idf) over contiguous keyword spans
atc	field	float	Aggregate Term Closeness, log(1+sum(idf1idf2pow(distance, -1.75)) over the best pairs of keywords
Document-level Ranking Factors
A document-level factor is a numeric value computed by the ranking engine for every matched document with regards to the current query. So it differs from a plain document attribute in that the attribute does not depend on the full text query, while factors might. These factors can be used anywhere in the ranking expression. Currently implemented document-level factors are:

bm25 (integer), a document-level BM25 estimate (computed without keyword occurrence filtering).
max_lcs (integer), a query-level maximum possible value that the sum(lcs*user_weight) expression can ever take. This can be useful for weight boost scaling. For instance, MATCHANY ranker formula uses this to guarantee that a full phrase match in any field ranks higher than any combination of partial matches in all fields.
field_mask (integer), a document-level 32-bit mask of matched fields.
query_word_count (integer), the number of unique keywords in a query, adjusted for the number of excluded keywords. For instance, both (one one one one) and (one !two) queries should assign a value of 1 to this factor, because there is just one unique non-excluded keyword.
doc_word_count (integer), the number of unique keywords matched in the entire document.
Field-level Ranking Factors
A field-level factor is a numeric value computed by the ranking engine for every matched in-document text field regards to the current query. As more than one field can be matched by a query, but the final weight needs to be a single integer value, these values need to be folded into a single one. To achieve that, field-level factors can only be used within a field aggregation function, they can not be used anywhere in the expression. For example, you cannot use (lcs+bm25) as your ranking expression, as lcs takes multiple values (one in every matched field). You should use (sum(lcs)+bm25) instead, that expression sums lcs over all matching fields, and then adds bm25 to that per-field sum. Currently implemented field-level factors are:

lcs (integer), the length of a maximum verbatim match between the document and the query, counted in words. LCS stands for Longest Common Subsequence (or Subset). Takes a minimum value of 1 when only stray keywords were matched in a field, and a maximum value of query keywords count when the entire query was matched in a field verbatim (in the exact query keywords order). For example, if the query is 'hello world' and the field contains these two words quoted from the query (that is, adjacent to each other, and exactly in the query order), lcs will be 2. For example, if the query is 'hello world program' and the field contains 'hello world', lcs will be 2. Note that any subset of the query keyword works, not just a subset of adjacent keywords. For example, if the query is 'hello world program' and the field contains 'hello (test program)', lcs will be 2 just as well, because both 'hello' and 'program' matched in the same respective positions as they were in the query. Finally, if the query is 'hello world program' and the field contains 'hello world program', lcs will be 3. (Hopefully that is unsurprising at this point.)

user_weight (integer), the user specified per-field weight (refer to OPTION field_weights in SQL). The weights default to 1 if not specified explicitly.

hit_count (integer), the number of keyword occurrences that matched in the field. Note that a single keyword may occur multiple times. For example, if 'hello' occurs 3 times in a field and 'world' occurs 5 times, hit_count will be 8.

word_count (integer), the number of unique keywords matched in the field. For example, if 'hello' and 'world' occur anywhere in a field, word_count will be 2, regardless of how many times both keywords occur.

tf_idf (float), the sum of TF/IDF over all the keywords matched in the field. IDF is the Inverse Document Frequency, a floating point value between 0 and 1 that describes how frequent the keyword is (basically, 0 for a keyword that occurs in every document indexed, and 1 for a unique keyword that occurs in just a single document). TF is the Term Frequency, the number of matched keyword occurrences in the field. As a side note, tf_idf is actually computed by summing IDF over all matched occurrences. That's by construction equivalent to summing TF*IDF over all matched keywords.

min_hit_pos (integer), the position of the first matched keyword occurrence, counted in words

Therefore, this is a relatively low-level, "raw" factor that you'll likely want to adjust before using it for ranking. The specific adjustments depend heavily on your data and the resulting formula, but here are a few ideas to start with: (a) any min_gaps-based boosts could be simply ignored when word_count<2;

(b) non-trivial min_gaps values (i.e., when word_count>=2) could be clamped with a certain "worst-case" constant, while trivial values (i.e., when min_gaps=0 and word_count<2) could be replaced by that constant;

(c) a transfer function like 1/(1+min_gaps) could be applied (so that better, smaller min_gaps values would maximize it, and worse, larger min_gaps values would fall off slowly); and so on.

lccs (integer). Longest Common Contiguous Subsequence. The length of the longest subphrase common between the query and the document, computed in keywords.

The LCCS factor is somewhat similar to LCS but more restrictive. While LCS can be greater than 1 even if no two query words are matched next to each other, LCCS will only be greater than 1 if there are exact, contiguous query subphrases in the document. For example, (one two three four five) query vs (one hundred three hundred five hundred) document would yield lcs=3, but lccs=1, because although the mutual dispositions of 3 keywords (one, three, five) match between the query and the document, no 2 matching positions are actually adjacent.

Note that LCCS still doesn't differentiate between frequent and rare keywords; for that, see WLCCS.

wlccs (float). Weighted Longest Common Contiguous Subsequence. The sum of IDFs of the keywords of the longest subphrase common between the query and the document.

WLCCS is calculated similarly to LCCS, but every "suitable" keyword occurrence increases it by the keyword IDF instead of just by 1 (as with LCS and LCCS). This allows ranking sequences of rarer and more important keywords higher than sequences of frequent keywords, even if the latter are longer. For example, a query (Zanzibar bed and breakfast) would yield lccs=1 for a (hotels of Zanzibar) document, but lccs=3 against (London bed and breakfast), even though "Zanzibar" is actually somewhat rarer than the entire "bed and breakfast" phrase. The WLCCS factor addresses this issue by using keyword frequencies.

atc (float). Aggregate Term Closeness. A proximity-based measure that increases when the document contains more groups of more closely located and more important (rare) query keywords.

WARNING: you should use ATC with OPTION idf='plain,tfidf_unnormalized' (see below); otherwise, you may get unexpected results.

ATC essentially operates as follows. For each keyword occurrence in the document, we compute the so-called term closeness. To do this, we examine all the other closest occurrences of all the query keywords (including the keyword itself) to the left and right of the subject occurrence, calculate a distance dampening coefficient as k = pow(distance, -1.75) for these occurrences, and sum the dampened IDFs. As a result, for every occurrence of each keyword, we obtain a "closeness" value that describes the "neighbors" of that occurrence. We then multiply these per-occurrence closenesses by their respective subject keyword IDF, sum them all, and finally compute a logarithm of that sum.

In other words, we process the best (closest) matched keyword pairs in the document, and compute pairwise "closenesses" as the product of their IDFs scaled by the distance coefficient:

pair_tc = idf(pair_word1) * idf(pair_word2) * pow(pair_distance, -1.75)
We then sum such closenesses, and compute the final, log-dampened ATC value:

atc = log(1+sum(pair_tc))
Note that this final dampening logarithm is precisely the reason you should use OPTION idf=plain because, without it, the expression inside the log() could be negative.

Having closer keyword occurrences contributes much more to ATC than having more frequent keywords. Indeed, when the keywords are right next to each other, distance=1 and k=1; when there's just one word in between them, distance=2 and k=0.297, with two words between, distance=3 and k=0.146, and so on. At the same time, IDF attenuates somewhat slower. For example, in a 1 million document collection, the IDF values for keywords that match in 10, 100, and 1000 documents would be respectively 0.833, 0.667, and 0.500. So a keyword pair with two rather rare keywords that occur in just 10 documents each but with 2 other words in between would yield pair_tc = 0.101 and thus barely outweigh a pair with a 100-doc and a 1000-doc keyword with 1 other word between them and pair_tc = 0.099. Moreover, a pair of two unique, 1-doc keywords with 3 words between them would get a pair_tc = 0.088 and lose to a pair of two 1000-doc keywords located right next to each other and yielding a pair_tc = 0.25. So, basically, while ATC does combine both keyword frequency and proximity, it still somewhat favors proximity.

Ranking factor aggregation functions
A field aggregation function is a single-argument function that accepts an expression with field-level factors, iterates over all matched fields, and computes the final results. The currently implemented field aggregation functions include:

sum, which adds the argument expression over all matched fields. For example sum(1) should return the number of matched fields.
top, which returns the highest value of the argument across all matched fields.
max_window_hits, manages a sliding window of hit positions to track the maximum number of hits within a specified window size. It removes outdated hits that fall outside the window and adds the latest hit, updating the maximum number of hits found within that window.
Formula expressions for all the built-in rankers
Most other rankers can actually be emulated using the expression-based ranker. You just need to provide an appropriate expression. While this emulation will likely be slower than using the built-in, compiled ranker, it may still be interesting if you want to fine-tune your ranking formula starting with one of the existing ones. Additionally, the formulas describe the ranker details in a clear, readable manner.

proximity_bm25 (default ranker) = sum(lcs*user_weight)*1000+bm25
bm25 = sum(user_weight)*1000+bm25
none = 1
wordcount = sum(hit_count*user_weight)
proximity = sum(lcs*user_weight)
matchany = sum((word_count+(lcs-1)*max_lcs)*user_weight)
fieldmask = field_mask
sph04 = sum((4*lcs+2*(min_hit_pos==1)+exact_hit)*user_weight)*1000+bm25
Configuration of IDF formula
The historically default IDF (Inverse Document Frequency) in Manticore is equivalent to OPTION idf='normalized,tfidf_normalized', and those normalizations may cause several undesired effects.

First, idf=normalized causes keyword penalization. For instance, if you search for the | something and the occurs in more than 50% of the documents, then documents with both keywords the and[something will get less weight than documents with just one keyword something. Using OPTION idf=plain avoids this.

Plain IDF varies in [0, log(N)] range, and keywords are never penalized; while the normalized IDF varies in [-log(N), log(N)] range, and too frequent keywords are penalized.

Second, idf=tfidf_normalized causes IDF drift over queries. Historically, we additionally divided IDF by query keyword count, so that the entire sum(tf*idf) over all keywords would still fit into [0,1] range. However, that means that queries word1 and word1 | nonmatchingword2 would assign different weights to the exactly same result set, because the IDFs for both word1 and nonmatchingword2 would be divided by 2. OPTION idf='tfidf_unnormalized' fixes that. Note that BM25, BM25A, BM25F() ranking factors will be scale accordingly once you disable this normalization.

IDF flags can be mixed; plain and normalized are mutually exclusive;tfidf_unnormalized and tfidf_normalized are mutually exclusive; and unspecified flags in such a mutually exclusive group take their defaults. That means that OPTION idf=plain is equivalent to a complete OPTION idf='plain,tfidf_normalized' specification.

----------------------------    ----------------
Manticore provides the fuzzy search option and the commands CALL QSUGGEST and CALL SUGGEST that can be used for automatic spell correction purposes.

Fuzzy Search
The Fuzzy Search feature allows for more flexible matching by accounting for slight variations or misspellings in the search query. It works similarly to a normal SELECT SQL statement or a /search JSON request but provides additional parameters to control the fuzzy matching behavior.

NOTE: The fuzzy option requires Manticore Buddy. If it doesn't work, make sure Buddy is installed.

General syntax
SQL
SELECT
  ...
  MATCH('...')
  ...
  OPTION fuzzy={0|1}
  [, distance=N]
  [, preserve={0|1}]
  [, layouts='{be,bg,br,ch,de,dk,es,fr,uk,gr,it,no,pt,ru,se,ua,us}']
}
Note: When conducting a fuzzy search via SQL, the MATCH clause should not contain any full-text operators except the phrase search operator and should only include the words you intend to match.

‹›
SQL
SQL with additional filters
JSON
SQL with preserve option
JSON with preserve option
📋
SELECT * FROM mytable WHERE MATCH('someting') OPTION fuzzy=1, layouts='us,ua', distance=2;
‹›
Response
+------+-------------+
| id   | content     |
+------+-------------+
|    1 | something   |
|    2 | some thing  |
+------+-------------+
2 rows in set (0.00 sec)
JSON
POST /search
{
  "table": "table_name",
  "query": {
    <full-text query>
  },
  "options": {
    "fuzzy": {true|false}
    [,"layouts": ["be","bg","br","ch","de","dk","es","fr","uk","gr","it","no","pt","ru","se","ua","us"]]
    [,"distance": N]
    [,"preserve": {0|1}]
  }
}
Note: If you use the query_string, be aware that it does not support full-text operators except the phrase search operator. The query string should consist solely of the words you wish to match.

Options
fuzzy: Turn fuzzy search on or off.
distance: Set the Levenshtein distance for matching. The default is 2.
preserve: 0 or 1 (default: 0). When set to 1, keeps words that don't have fuzzy matches in the search results (e.g., "hello wrld" returns both "hello wrld" and "hello world"). When set to 0, only returns words with successful fuzzy matches (e.g., "hello wrld" returns only "hello world"). Particularly useful for preserving short words or proper nouns that may not exist in Manticore Search.
layouts: Keyboard layouts for detecting typing errors caused by keyboard layout mismatches (e.g., typing "ghbdtn" instead of "привет" when using wrong layout). Manticore compares character positions across different layouts to suggest corrections. Requires at least 2 layouts to effectively detect mismatches. No layouts are used by default. Use an empty string '' (SQL) or array [] (JSON) to turn this off. Supported layouts include:
be - Belgian AZERTY layout
bg - Standard Bulgarian layout
br - Brazilian QWERTY layout
ch - Swiss QWERTZ layout
de - German QWERTZ layout
dk - Danish QWERTY layout
es - Spanish QWERTY layout
fr - French AZERTY layout
uk - British QWERTY layout
gr - Greek QWERTY layout
it - Italian QWERTY layout
no - Norwegian QWERTY layout
pt - Portuguese QWERTY layout
ru - Russian JCUKEN layout
se - Swedish QWERTY layout
ua - Ukrainian JCUKEN layout
us - American QWERTY layout
Links
This demo demonstrates the fuzzy search functionality: Fuzzy search example
Blog post about Fuzzy Search and Autocomplete - https://manticoresearch.com/blog/new-fuzzy-search-and-autocomplete/
CALL QSUGGEST, CALL SUGGEST
Both commands are accessible via SQL and support querying both local (plain and real-time) and distributed tables. The syntax is as follows:

CALL QSUGGEST(<word or words>, <table name> [,options])
CALL SUGGEST(<word or words>, <table name> [,options])

options: N as option_name[, M as another_option, ...]
These commands provide all suggestions from the dictionary for a given word. They work only on tables with infixing enabled and dict=keywords. They return the suggested keywords, Levenshtein distance between the suggested and original keywords, and the document statistics of the suggested keyword.

If the first parameter contains multiple words, then:

CALL QSUGGEST will return suggestions only for the last word, ignoring the rest.
CALL SUGGEST will return suggestions only for the first word.
That's the only difference between them. Several options are supported for customization:

Option	Description	Default
limit	Returns N top matches	5
max_edits	Keeps only dictionary words with a Levenshtein distance less than or equal to N	4
result_stats	Provides Levenshtein distance and document count of the found words	1 (enabled)
delta_len	Keeps only dictionary words with a length difference less than N	3
max_matches	Number of matches to keep	25
reject	Rejected words are matches that are not better than those already in the match queue. They are put in a rejected queue that gets reset in case one actually can go in the match queue. This parameter defines the size of the rejected queue (as reject*max(max_matched,limit)). If the rejected queue is filled, the engine stops looking for potential matches	4
result_line	alternate mode to display the data by returning all suggests, distances and docs each per one row	0
non_char	do not skip dictionary words with non alphabet symbols	0 (skip such words)
sentence	Returns the original sentence along with the last word replaced by the matched one.	0 (do not return the full sentence)
To show how it works, let's create a table and add a few documents to it.

create table products(title text) min_infix_len='2';
insert into products values (0,'Crossbody Bag with Tassel'), (0,'microfiber sheet set'), (0,'Pet Hair Remover Glove');
Single word example
As you can see, the mistyped word "crossbUdy" gets corrected to "crossbody". By default, CALL SUGGEST/QSUGGEST return:

distance - the Levenshtein distance which means how many edits they had to make to convert the given word to the suggestion
docs - number of documents containing the suggested word
To disable the display of these statistics, you can use the option 0 as result_stats.

‹›
Example
📋
call suggest('crossbudy', 'products');
‹›
Response
+-----------+----------+------+
| suggest   | distance | docs |
+-----------+----------+------+
| crossbody | 1        | 1    |
+-----------+----------+------+
CALL SUGGEST takes only the first word
If the first parameter is not a single word, but multiple, then CALL SUGGEST will return suggestions only for the first word.

‹›
Example
📋
call suggest('bagg with tasel', 'products');
‹›
Response
+---------+----------+------+
| suggest | distance | docs |
+---------+----------+------+
| bag     | 1        | 1    |
+---------+----------+------+
CALL QSUGGEST takes only the last word
If the first parameter is not a single word, but multiple, then CALL SUGGEST will return suggestions only for the last word.

‹›
Example
📋
CALL QSUGGEST('bagg with tasel', 'products');
‹›
Response
+---------+----------+------+
| suggest | distance | docs |
+---------+----------+------+
| tassel  | 1        | 1    |
+---------+----------+------+
Adding 1 as sentence makes CALL QSUGGEST return the entire sentence with the last word corrected.

‹›
Example
📋
CALL QSUGGEST('bag with tasel', 'products', 1 as sentence);
‹›
Response
+-------------------+----------+------+
| suggest           | distance | docs |
+-------------------+----------+------+
| bag with tassel   | 1        | 1    |
+-------------------+----------+------+
Different display mode
The 1 as result_line option changes the way the suggestions are displayed in the output. Instead of showing each suggestion in a separate row, it displays all suggestions, distances, and docs in a single row. Here's an example to demonstrate this:

Demo
This interactive course shows how CALL SUGGEST works in a little web app.
