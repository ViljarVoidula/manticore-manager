Filters
WHERE
WHERE is an SQL clause that works for both full-text matching and additional filtering. The following operators are available:

Comparison operators <, >, <=, >=, =, <>, BETWEEN, IN, IS NULL
Boolean operators AND, OR, NOT
MATCH('query') is supported and maps to a full-text query.

The {col_name | expr_alias} [NOT] IN @uservar condition syntax is supported. Refer to the SET syntax for a description of global user variables.

HTTP JSON
If you prefer the HTTP JSON interface, you can also apply filtering. It might seem more complex than SQL, but it is recommended for cases when you need to prepare a query programmatically, such as when a user fills out a form in your application.

Here's an example of several filters in a bool query.

This full-text query matches all documents containing product in any field. These documents must have a price greater than or equal to 500 (gte ) and less than or equal to 1000 (lte ). All of these documents must not have a revision less than 15 (lt ).

‹›
JSON
📋
⚙
POST /search
{
  "table": "test1",
  "query": {
    "bool": {
      "must": [
        { "match" : { "_all" : "product" } },
        { "range": { "price": { "gte": 500, "lte": 1000 } } }
      ],
      "must_not": {
        "range": { "revision": { "lt": 15 } }
      }
    }
  }
} 
bool query
The bool query matches documents based on boolean combinations of other queries and/or filters. Queries and filters must be specified in must , should , or must_not sections and can be nested.

‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "bool": {
      "must": [
        { "match": {"_all":"keyword"} },
        { "range": { "revision": { "gte": 14 } } }
      ]
    }
  }
} 
must
Queries and filters specified in the must section are required to match the documents. If multiple fulltext queries or filters are specified, all of them must match. This is the equivalent of AND queries in SQL. Note that if you want to match against an array (multi-value attribute), you can specify the attribute multiple times. The result will be positive only if all the queried values are found in the array, e.g.:

"must": [
  {"equals" : { "product_codes": 5 }},
  {"equals" : { "product_codes": 6 }}
] 
Note also, it may be better in terms of performance to use:

  {"in" : { "all(product_codes)": [5,6] }} 
(see details below).

should
Queries and filters specified in the should section should match the documents. If some queries are specified in must or must_not , should queries are ignored. On the other hand, if there are no queries other than should , then at least one of these queries must match a document for it to match the bool query. This is the equivalent of OR queries. Note, if you want to match against an array (multi-value attribute) you can specify the attribute multiple times, e.g.:

"should": [
  {"equals" : { "product_codes": 7 }},
  {"equals" : { "product_codes": 8 }}
] 
Note also, it may be better in terms of performance to use:

  {"in" : { "any(product_codes)": [7,8] }} 
(see details below).

must_not
Queries and filters specified in the must_not section must not match the documents. If several queries are specified under must_not , the document matches if none of them match.

‹›
JSON
📋
⚙
POST /search
{
  "table":"t",
  "query": {
    "bool": {
      "should": [
        {
          "equals": {
            "b": 1
          }
        },
        {
          "equals": {
            "b": 3
          }
        }
      ],
      "must": [
        {
          "equals": {
            "a": 1
          }
        }
      ],
      "must_not": {
        "equals": {
          "b": 2
        }
      }
    }
  }
} 
Nested bool query
A bool query can be nested inside another bool so you can make more complex queries. To make a nested boolean query just use another bool instead of must , should or must_not . Here is how this query:

a = 2 and (a = 10 or b = 0) 
should be presented in JSON.

‹›
JSON
📋
⚙
a = 2 and (a = 10 or b = 0)

POST /search
{
  "table":"t",
  "query": {
    "bool": {
      "must": [
        {
          "equals": {
            "a": 2
          }
        },
        {
          "bool": {
            "should": [
              {
                "equals": {
                  "a": 10
                }
              },
              {
                "equals": {
                  "b": 0
                }
              }
            ]
          }
        }
      ]
    }
  }
} 
More complex query:

(a = 1 and b = 1) or (a = 10 and b = 2) or (b = 0) 
‹›
JSON
📋
⚙
(a = 1 and b = 1) or (a = 10 and b = 2) or (b = 0)

POST /search
{
  "table":"t",
  "query": {
    "bool": {
      "should": [
        {
          "bool": {
            "must": [
              {
                "equals": {
                  "a": 1
                }
              },
              {
                "equals": {
                  "b": 1
                }
              }
            ]
          }
        },
        {
          "bool": {
            "must": [
              {
                "equals": {
                  "a": 10
                }
              },
              {
                "equals": {
                  "b": 2
                }
              }
            ]
          }
        },
        {
          "bool": {
            "must": [
              {
                "equals": {
                  "b": 0
                }
              }
            ]
          }

        }
      ]
    }
  }
} 
Queries in SQL format
Queries in SQL format (query_string ) can also be used in bool queries.

‹›
JSON
📋
⚙
POST /search
{
  "table": "test1",
  "query": {
    "bool": {
      "must": [
        { "query_string" : "product" },
        { "query_string" : "good" }
      ]
    }
  }
} 
Various filters
Equality filters
Equality filters are the simplest filters that work with integer, float and string attributes.

‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "equals": { "price": 500 }
  }
} 
Filter equals can be applied to a multi-value attribute and you can use:

any() which will be positive if the attribute has at least one value which equals to the queried value;
all() which will be positive if the attribute has a single value and it equals to the queried value
‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "equals": { "any(price)": 100 }
  }
} 
Set filters
Set filters check if attribute value is equal to any of the values in the specified set.

Set filters support integer, string and multi-value attributes.

‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "in": {
      "price": [1,10,100]
    }
  }
} 
When applied to a multi-value attribute you can use:

any() (equivalent to no function) which will be positive if there's at least one match between the attribute values and the queried values;
all() which will be positive if all the attribute values are in the queried set
‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "in": {
      "all(price)": [1,10]
    }
  }
} 
Range filters
Range filters match documents that have attribute values within a specified range.

Range filters support the following properties:

gte : greater than or equal to
gt : greater than
lte : less than or equal to
lt : less than
‹›
JSON
📋
⚙
POST /search
{
  "table":"test1",
  "query": {
    "range": {
      "price": {
        "gte": 500,
        "lte": 1000
      }
    }
  }
} 
Geo distance filters
geo_distance filters are used to filter the documents that are within a specific distance from a geo location.

location_anchor
Specifies the pin location, in degrees. Distances are calculated from this point.

location_source
Specifies the attributes that contain latitude and longitude.

distance_type
Specifies distance calculation function. Can be either adaptive or haversine. adaptive is faster and more precise, for more details see GEODIST() . Optional, defaults to adaptive.

distance
Specifies the maximum distance from the pin locations. All documents within this distance match. The distance can be specified in various units. If no unit is specified, the distance is assumed to be in meters. Here is a list of supported distance units:

Meter: m or meters
Kilometer: km or kilometers
Centimeter: cm or centimeters
Millimeter: mm or millimeters
Mile: mi or miles
Yard: yd or yards
Feet: ft or feet
Inch: in or inch
Nautical mile: NM , nmi or nauticalmiles
location_anchor and location_source properties accept the following latitude/longitude formats:

an object with lat and lon keys: { "lat": "attr_lat", "lon": "attr_lon" }
a string of the following structure: "attr_lat, attr_lon"
an array with the latitude and longitude in the following order: [attr_lon, attr_lat]
Latitude and longitude are specified in degrees.