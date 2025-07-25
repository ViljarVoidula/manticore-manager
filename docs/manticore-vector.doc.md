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