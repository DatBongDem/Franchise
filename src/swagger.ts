import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'FranchiseStore API (Node.js Express)',
        version: '1.0.0',
        description: 'Franchise Store Management System converted from C# to Node.js with SQL Server'
    },
    servers: [
        {
            url: 'http://localhost:5000',
            description: 'Local Development Server'
        }
    ],
    components: {
        securitySchemes: {
            Bearer: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT Bearer token'
            }
        }
    },
    security: [
        {
            Bearer: []
        }
    ],
    paths: {
        '/api/users/login': {
            post: {
                summary: 'User Login',
                tags: ['Users'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    gmail: { type: 'string', example: 'admin@franchise.com' },
                                    password: { type: 'string', example: 'Admin@123' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Successful login returning JWT' },
                    401: { description: 'Invalid credentials' }
                }
            }
        },
        '/api/users': {
            get: {
                summary: 'Get All Users (ADMIN, MANAGER)',
                description: 'Returns the C# UserDto list, including blocked accounts and excluding password data.',
                tags: ['Users'],
                responses: {
                    200: { description: 'List of user profiles; empty array when none exist' },
                    401: { description: 'Authentication required' },
                    403: { description: 'ADMIN or MANAGER role required' },
                    500: { description: 'An internal error occurred.' }
                }
            },
            post: {
                summary: 'Create User (ADMIN)',
                tags: ['Users'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    gmail: { type: 'string' },
                                    password: { type: 'string' },
                                    phoneNumber: { type: 'string' },
                                    address: { type: 'string' },
                                    gender: { type: 'string' },
                                    dateOfBirth: { type: 'string', format: 'date' },
                                    role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'STORESTAFF', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR'] },
                                    idStore: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Created user' } }
            }
        },
        '/api/stores': {
            get: {
                summary: 'Get All Stores',
                description: 'Public endpoint matching the C# StoreDto list, including inactive stores. Also available at /api/store.',
                tags: ['Stores'],
                security: [],
                responses: {
                    200: { description: 'StoreDto list; empty array when none exist', content: { 'application/json': { schema: {
                        type: 'array', items: { type: 'object', properties: {
                            storeId: { type: 'string', format: 'uuid' },
                            storeName: { type: 'string' },
                            address: { type: 'string', nullable: true },
                            status: { type: 'boolean' }
                        } }
                    } } } },
                    400: { description: 'Store lookup failed' }
                }
            },
            post: {
                summary: 'Create store and initial Creating order',
                tags: ['Stores'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    storeName: { type: 'string' },
                                    address: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Create store and initial order successfully' },
                    400: { description: 'Invalid input or store/order creation failed' }
                }
            }
        },
        '/api/category': {
            get: {
                summary: 'Get All Categories',
                tags: ['Categories'],
                responses: { 200: { description: 'List of categories' } }
            },
            post: {
                summary: 'Create Category',
                tags: ['Categories'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    categoryName: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Created category' } }
            }
        },
        '/api/product': {
            get: {
                summary: 'Get All Products',
                tags: ['Products'],
                responses: { 200: { description: 'List of products' } }
            },
            post: {
                summary: 'Create Product',
                tags: ['Products'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    categoryId: { type: 'string' },
                                    productName: { type: 'string' },
                                    price: { type: 'number' },
                                    sellingPrice: { type: 'number' },
                                    unit: { type: 'string' },
                                    numberOfDaysToExpire: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Created product' } }
            }
        },
        '/api/order': {
            get: {
                summary: 'Get All Orders',
                tags: ['Orders'],
                responses: { 200: { description: 'List of orders' } }
            }
        },
        '/api/order/orders': {
            get: {
                summary: 'Get kitchen orders with product batch details',
                description: 'Returns WaitingForCooking, Cooking and Cooked orders with productBatches, matching the C# OrderWithBatchesDto. Requires authentication.',
                tags: ['Orders'],
                responses: {
                    200: { description: 'Kitchen orders with batch/product details; empty array when none exist' },
                    401: { description: 'Authentication required' },
                    500: { description: 'An error occurred while retrieving kitchen orders.' }
                }
            }
        },
        '/api/order/check-creating': {
            get: {
                summary: 'Check if current store has creating order',
                tags: ['Orders'],
                responses: { 200: { description: 'Order ID or false' } }
            }
        },
        '/api/order/{orderId}/start-cooking': {
            put: {
                summary: 'Start cooking and record ingredient usage (KITCHENSTAFF)',
                description: 'Matches C#: WaitingForCooking becomes Cooking with Vietnam time; existing CookingTime is preserved for Cooking orders. Cooked batches keep their status. Ingredient histories use UTC and quantity per recipe multiplied by batch quantity.',
                tags: ['Orders'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order has started cooking and ingredient history has been recorded.' },
                    400: { description: 'Invalid order ID/status, no batches, or recipe references a missing ingredient' },
                    401: { description: 'Authentication or user ID required' },
                    403: { description: 'KITCHENSTAFF role required' },
                    404: { description: 'Order not found.' },
                    500: { description: 'An error occurred while starting to cook the order.' }
                }
            }
        },
        '/api/order/{orderId}/finish-cooking': {
            put: {
                summary: 'Finish cooking an order (KITCHENSTAFF)',
                description: 'Marks the order and its product batches Cooked. Manufacture and expiry use Vietnam time, matching FranchiseStore.',
                tags: ['Orders'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order has finished cooking.' },
                    400: { description: 'Invalid order ID' },
                    401: { description: 'Authentication required' },
                    403: { description: 'KITCHENSTAFF role required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while finishing cooking the order.' }
                }
            }
        },
        '/api/delivery': {
            get: {
                summary: 'Get Orders Available for Delivery Coordinator',
                tags: ['Delivery'],
                responses: { 200: { description: 'Orders list' } }
            }
        },
        '/api/delivery/{orderId}/pickup': {
            put: {
                summary: 'Pick up a pending order (SUPPLYCOORDINATOR)',
                description: 'Changes Pending to PickedUp and records the pickup time in Vietnam time, matching FranchiseStore.',
                tags: ['Delivery'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order picked up successfully.' },
                    400: { description: 'Invalid order ID or order status is not suitable for pickup.' },
                    401: { description: 'Authentication required' },
                    403: { description: 'SUPPLYCOORDINATOR role required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while picking up the order.' }
                }
            }
        },
        '/api/delivery/{orderId}/send-to-kitchen': {
            put: {
                summary: 'Send a picked-up order to the kitchen (SUPPLYCOORDINATOR)',
                description: 'Changes PickedUp to WaitingForCooking and records KitchenReceivedTime in Vietnam time, matching FranchiseStore.',
                tags: ['Delivery'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order sent to kitchen successfully.' },
                    400: { description: 'Invalid order ID or order is not PickedUp' },
                    401: { description: 'Authentication required' },
                    403: { description: 'SUPPLYCOORDINATOR role required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while sending the order to the kitchen.' }
                }
            }
        },
        '/api/delivery/{orderId}/take-from-kitchen': {
            put: {
                summary: 'Take a cooked order from the kitchen (SUPPLYCOORDINATOR)',
                description: 'Changes Cooked to TakenFrom and records TakenFromKitchenTime in Vietnam time, matching FranchiseStore.',
                tags: ['Delivery'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order taken from kitchen successfully.' },
                    400: { description: 'Invalid order ID or order is not Cooked' },
                    401: { description: 'Authentication required' },
                    403: { description: 'SUPPLYCOORDINATOR role required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while taking the order from the kitchen.' }
                }
            }
        },
        '/api/delivery/{orderId}/arrive-at-store': {
            put: {
                summary: 'Mark an order as arrived at the store',
                description: 'Changes TakenFrom to Arrived and records ArrivedTime in Vietnam time. Public endpoint, matching FranchiseStore.',
                tags: ['Delivery'],
                security: [],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Order has arrived at the store successfully.' },
                    400: { description: 'Invalid order ID or order is not TakenFrom' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while marking the order as arrived.' }
                }
            }
        },
        '/api/order/{orderId}/complete': {
            put: {
                summary: 'Complete an arrived order (STORESTAFF)',
                description: 'Changes Arrived to Completed, records Vietnam time and saves optional feedback. Product batches are unchanged, matching FranchiseStore.',
                tags: ['Orders'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', properties: { feedback: { type: 'string', nullable: true } }
                } } } },
                responses: {
                    200: { description: 'Order marked as completed successfully.' },
                    400: { description: 'Invalid input or order is not Arrived' },
                    401: { description: 'Authentication required' },
                    403: { description: 'STORESTAFF role required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while completing the order.' }
                }
            }
        },
        '/api/quantitative/{productId}': {
            put: {
                summary: 'Update an existing quantitative rule for the token store',
                tags: ['Quantitative'],
                parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 1, maximum: 2147483647 } }
                } } } },
                responses: {
                    204: { description: 'Quantitative rule updated' },
                    400: { description: 'Invalid product ID or quantity' },
                    401: { description: 'Authentication or valid token store required' },
                    404: { description: 'Quantitative rule not found for the specified product and store.' },
                    500: { description: 'An unexpected error occurred.' }
                }
            }
        },
        '/api/recipe/{id}/with-ingredients': {
            get: {
                summary: 'Get recipe with ingredients',
                tags: ['Recipes'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'RecipeResponseDto', content: { 'application/json': { schema: {
                        type: 'object', properties: {
                            recipeID: { type: 'string', format: 'uuid' },
                            description: { type: 'string' },
                            ingredients: { type: 'array', items: { type: 'object', properties: {
                                ingredientID: { type: 'string', format: 'uuid' }, quantity: { type: 'number' }
                            } } }
                        }
                    } } } },
                    204: { description: 'Recipe not found (C# Ok(null))' },
                    400: { description: 'Invalid recipe ID' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/ingredient/{id}': {
            get: {
                summary: 'Get ingredient by ID', tags: ['Ingredients'], security: [],
                description: 'Returns the C# Ingredient shape without Status, with unloaded navigation collections as empty arrays.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Ingredient' }, 404: { description: 'Ingredient not found or invalid GUID route' }, 500: { description: 'Lookup failed' } }
            },
            put: {
                summary: 'Update ingredient name and unit',
                description: 'Public endpoint matching the C# IngredientDto. Other fields are ignored.',
                tags: ['Ingredients'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['ingredientName', 'unit'], properties: {
                        ingredientName: { type: 'string' }, unit: { type: 'string' }
                    }
                } } } },
                responses: {
                    200: { description: 'Ingredient updated successfully' },
                    400: { description: 'Invalid ingredient data' },
                    404: { description: 'Ingredient not found or invalid GUID route' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/recipe/{id}': {
            delete: {
                summary: 'Delete a recipe', tags: ['Recipes'], security: [],
                description: 'Matches C#: an absent recipe throws from the repository and returns 500.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Recipe deleted successfully' }, 400: { description: 'Invalid recipe ID' }, 500: { description: 'Recipe not found or deletion failed' } }
            },
            put: {
                summary: 'Update recipe description and replace ingredients',
                description: 'Matches C#: ProductId is bound but not changed. Empty/omitted ingredients clear the recipe. Description and removal of old ingredients are saved first; the replacement collection is saved next. If replacement insertion fails, the first save remains committed.',
                tags: ['Recipes'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['description'], properties: {
                        productId: { type: 'string', format: 'uuid' }, description: { type: 'string' },
                        ingredients: { type: 'array', items: { type: 'object', properties: {
                            ingredientID: { type: 'string', format: 'uuid' }, quantity: { type: 'number' }
                        } } }
                    }
                } } } },
                responses: {
                    200: { description: 'Recipe updated successfully' },
                    400: { description: 'Invalid recipe ID or DTO' },
                    404: { description: 'Recipe not found' },
                    500: { description: 'Recipe update failed, including invalid replacement references or duplicate ingredients' }
                }
            },
            get: {
                summary: 'Get recipe by ID',
                description: 'Returns the C# Recipe shape. recipeIngredients is empty because this endpoint does not load the navigation collection.',
                tags: ['Recipes'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Recipe', content: { 'application/json': { schema: {
                        type: 'object', properties: {
                            recipeID: { type: 'string', format: 'uuid' },
                            productID: { type: 'string', format: 'uuid' },
                            description: { type: 'string' },
                            recipeIngredients: { type: 'array', items: { type: 'object' } }
                        }
                    } } } },
                    204: { description: 'Recipe not found (C# Ok(null))' },
                    400: { description: 'Invalid recipe ID' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/stores/{id}': {
            delete: {
                summary: 'Delete store by ID',
                description: 'Public endpoint matching C# store deletion. Also available at /api/store/{id}.',
                tags: ['Stores'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Delete store successfully' },
                    400: { description: 'Invalid store ID, store not found, or deletion failed' }
                }
            },
            put: {
                summary: 'Update store name and address',
                description: 'Matches C# UpdateStoreDto. A null or omitted address clears the address. Also available at /api/store/{id}.',
                tags: ['Stores'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['storeName'], properties: {
                        storeName: { type: 'string' }, address: { type: 'string', nullable: true }
                    }
                } } } },
                responses: {
                    200: { description: 'Update store successfully' },
                    400: { description: 'Invalid input, store not found, or update failed' }
                }
            },
            get: {
                summary: 'Get store by ID',
                description: 'Returns the C# StoreDto shape. Also available at /api/store/{id}.',
                tags: ['Stores'],
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'StoreDto', content: { 'application/json': { schema: {
                        type: 'object', properties: {
                            storeId: { type: 'string', format: 'uuid' },
                            storeName: { type: 'string' },
                            address: { type: 'string', nullable: true },
                            status: { type: 'boolean' }
                        }
                    } } } },
                    400: { description: 'Invalid store ID, store not found, or lookup failed' }
                }
            }
        },
        '/api/users/{id}/toggle-status': {
            put: {
                summary: 'Block or recover a user account (ADMIN)',
                description: 'Changes Active to Blocked; other existing statuses become Active, matching C#.',
                tags: ['Users'],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Account status changed', content: { 'application/json': { schema: {
                        type: 'object', properties: { message: { type: 'string' }, status: { type: 'string', enum: ['Active', 'Blocked'] } }
                    } } } },
                    401: { description: 'Authentication required' },
                    403: { description: 'ADMIN role required' },
                    404: { description: 'User not found or invalid GUID route' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/users/me': {
            get: {
                summary: 'Get current authenticated user',
                description: 'Returns the C# UserDto shape using the user ID from the verified token.',
                tags: ['Users'],
                responses: {
                    200: { description: 'Current user profile' },
                    401: { description: 'Authentication required or user ID missing/invalid in token' },
                    404: { description: 'User not found.' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/users/{id}': {
            get: {
                summary: 'Get user by ID (ADMIN, MANAGER)',
                description: 'Returns the C# UserDto shape without password data.',
                tags: ['Users'],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'User profile' },
                    401: { description: 'Authentication required' },
                    403: { description: 'ADMIN or MANAGER role required' },
                    404: { description: 'User not found or invalid GUID route' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/ingredient/ingredient-history': {
            get: {
                summary: 'Get paginated cooking ingredient history (KITCHENSTAFF)',
                description: 'Matches C#: data contains items, totalRecords, pageNumber, pageSize and totalPages. Each item contains ingredientId, ingredientName, quantityUsed and unit. Missing ingredient names use N/A. Newest histories first.',
                tags: ['Ingredients'],
                parameters: [
                    { name: 'pageNumber', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } }
                ],
                responses: {
                    200: { description: 'Paginated ingredient histories' },
                    400: { description: 'Invalid integer query parameter' },
                    401: { description: 'Authentication required' },
                    403: { description: 'KITCHENSTAFF role required' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/ingredient/{orderId}/ingredients': {
            get: {
                summary: 'Get cooking ingredient history for an order (KITCHENSTAFF)',
                description: 'Matches C#: returns ingredientId, ingredientName, quantityUsed and unit for histories linked by BatchId. Empty array for an existing order with no batches or histories. Missing ingredient names use N/A.',
                tags: ['Ingredients'],
                parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'Ingredient histories for the order' },
                    400: { description: 'Invalid order ID' },
                    401: { description: 'Authentication required' },
                    403: { description: 'KITCHENSTAFF role required' },
                    404: { description: 'Order not found.' },
                    500: { description: 'An error occurred while retrieving cooking ingredient history.' }
                }
            }
        },
        '/api/order/order-history/{storeId}': {
            get: {
                summary: 'Get order history for a store',
                description: 'Matches C#: route accepts STORESTAFF/MANAGER, but the database user must be MANAGER of this store. Filters SentTime inclusively and returns orderId, orderBy, createdTime, totalAmount, status and details. Detail unitPrice is the stored batch Price.',
                tags: ['Orders'],
                parameters: [
                    { name: 'storeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    { name: 'FromDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'ToDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'PageNumber', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'PageSize', in: 'query', schema: { type: 'integer', default: 10 } }
                ],
                responses: {
                    200: { description: 'Order history with totalRecords, pageNumber, pageSize and data' },
                    400: { description: 'Invalid store ID, date or pagination' },
                    401: { description: 'Authentication required' },
                    403: { description: 'User has no permission or token user ID is invalid' },
                    404: { description: 'User not found' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/bills/stores/{storeId}/revenue': {
            get: {
                summary: 'Get store revenue, cost and profit',
                description: 'Matches C#: route accepts STORESTAFF/MANAGER/ADMIN, but the database user must be MANAGER of this store. Date is required; EndDate must not precede Date. Includes the full end day. Returns summary and items grouped by product, using batch product Price for cost and bill-detail UnitPrice for revenue.',
                tags: ['Bills'],
                parameters: [
                    { name: 'storeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    { name: 'Date', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
                    { name: 'EndDate', in: 'query', schema: { type: 'string', format: 'date-time' } }
                ],
                responses: {
                    200: { description: 'summary: saleDate, totalRevenue, totalCost, totalProfit; items: storeId, saleDate, productId, productName, totalQuantitySold, totalRevenue, totalCost, profit' },
                    400: { description: 'Invalid input or date interval' },
                    401: { description: 'Authentication required' },
                    403: { description: 'User has no permission or token user ID is invalid' },
                    404: { description: 'User not found' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/productbatches/{storeId}/shrinkage': {
            get: {
                summary: 'Get store shrinkage at cost price',
                description: 'Matches C#: the database user must be MANAGER of this store. Uses remaining quantity times Product.Price, grouped by product and expiry date. Only non-null expiry strictly before UTC now and positive remaining stock qualify; order status is not filtered. Sorted by expiredDate then productName.',
                tags: ['Warehouse'],
                parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: {
                    200: { description: 'data.summary: storeId, calculatedAt, totalExpiredQuantity, totalLossAmount; data.items: storeId, productId, productName, expiredQuantity, lossAmount, expiredDate' },
                    400: { description: 'Invalid store ID' },
                    403: { description: 'Missing/invalid token user ID or no permission for this store' },
                    404: { description: 'User not found' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/bills/billingHistory/{storeId}': {
            get: {
                summary: 'Get billing history for a store',
                description: 'Matches C#: database user must be MANAGER of this store. Filters CreatedTime inclusively. data contains billId, createdTime, totalAmount and details; each detail contains billDetailId, productId, productName, quantity, unitPrice and totalPrice. Products are resolved through the sold batch.',
                tags: ['Bills'],
                parameters: [
                    { name: 'storeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    { name: 'FromDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'ToDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'PageNumber', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'PageSize', in: 'query', schema: { type: 'integer', default: 10 } }
                ],
                responses: {
                    200: { description: 'Billing history with totalRecords, pageNumber, pageSize and data' },
                    400: { description: 'Invalid store ID, date or pagination' },
                    401: { description: 'Authentication required' },
                    403: { description: 'No permission or invalid token user ID' },
                    404: { description: 'User not found' },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/order/{id}/cancel': {
            put: {
                summary: 'Cancel an order',
                description: 'Matches C#: any authenticated role can cancel orders except Completed/Canceled. Stores Vietnam time and returns OrderDto. Empty/null reasons are preserved. C# edge case: a null order UserId produces 400 after the cancellation has been saved.',
                tags: ['Orders'],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', properties: { cancellationReason: { type: 'string', nullable: true } }
                } } } },
                responses: {
                    200: { description: 'Updated OrderDto' },
                    400: { description: 'Invalid input, prohibited order state, or null order UserId after save' },
                    401: { description: 'Authentication required' },
                    404: { description: 'Order not found' },
                    500: { description: 'An error occurred while cancelling the order.' }
                }
            }
        },
        '/api/order/by-store': {
            get: {
                summary: 'Get order IDs for the token store (STORESTAFF)', tags: ['Orders'],
                description: 'Returns only an array of order IDs, including all statuses, for the store in the token.',
                responses: {
                    200: { description: 'Order IDs; empty array when none exist', content: { 'application/json': { schema: { type: 'array', items: { type: 'string', format: 'uuid' } } } } },
                    401: { description: 'Authentication or valid token store required' }, 403: { description: 'STORESTAFF role required' },
                    500: { description: 'An error occurred while retrieving order IDs by store.' }
                }
            }
        },
        '/api/bills': {
            post: {
                summary: 'Create Bill with FIFO Inventory Deduction',
                tags: ['Bills'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                productId: { type: 'string' },
                                                quantity: { type: 'number' }
                                            }
                                        }
                                    },
                                    note: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Created bill ID' } }
            }
        },
        '/api/bills/history': {
            get: {
                summary: 'Get Billing History for Staff',
                tags: ['Bills'],
                responses: { 200: { description: 'History list' } }
            }
        },
        '/api/productbatches/inventory/all': {
            get: {
                summary: 'Get All Inventory Across System',
                tags: ['Warehouse'],
                responses: { 200: { description: 'Inventory counts' } }
            }
        },
        '/api/ingredient': {
            post: {
                summary: 'Create an ingredient', tags: ['Ingredients'], security: [],
                description: 'Matches C# IngredientDto: ingredientName and unit only. Other fields such as Status are ignored.',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['ingredientName', 'unit'], properties: { ingredientName: { type: 'string' }, unit: { type: 'string' } }
                } } } },
                responses: {
                    201: { description: 'Created Ingredient', headers: { Location: { schema: { type: 'string' }, description: 'URL of created ingredient' } } },
                    400: { description: 'Invalid IngredientDto' }, 500: { description: 'Creation failed' }
                }
            },
            get: {
                summary: 'Get All Ingredients',
                description: 'Returns C# Ingredient entities with ingredientId, ingredientName, unit and two empty navigation collections. Status is excluded.',
                tags: ['Ingredients'],
                security: [],
                responses: { 200: { description: 'List of ingredients' } }
            }
        },
        '/api/recipe': {
            post: {
                summary: 'Create a recipe with ingredients',
                description: 'Matches C#: rejects an existing product recipe, duplicate ingredients and missing ingredients before writing. Returns the submitted DTO with a Location header. Business/service exceptions return 500.',
                tags: ['Recipes'],
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['description'], properties: {
                        productId: { type: 'string', format: 'uuid' },
                        description: { type: 'string' },
                        ingredients: { type: 'array', items: { type: 'object', properties: {
                            ingredientID: { type: 'string', format: 'uuid' }, quantity: { type: 'number' }
                        } } }
                    }
                } } } },
                responses: {
                    201: { description: 'Recipe created; response contains productId, description and ingredients', headers: {
                        Location: { description: 'URL of the created recipe', schema: { type: 'string' } }
                    } },
                    400: { description: 'Invalid DTO or field format' },
                    500: { description: 'Duplicate recipe, empty/duplicate/missing ingredients, or database error' }
                }
            },
            get: {
                summary: 'Get All Recipes',
                description: 'Returns the C# Recipe shape without loading the ingredient navigation collection.',
                tags: ['Recipes'],
                security: [],
                responses: {
                    200: { description: 'List of recipes; empty array when none exist', content: { 'application/json': { schema: {
                        type: 'array', items: { type: 'object', properties: {
                            recipeID: { type: 'string', format: 'uuid' },
                            productID: { type: 'string', format: 'uuid' },
                            description: { type: 'string' },
                            recipeIngredients: { type: 'array', items: { type: 'object' } }
                        } }
                    } } } },
                    500: { description: 'An internal error occurred.' }
                }
            }
        },
        '/api/quantitative': {
            get: {
                summary: 'Get Quantitatives for Store',
                description: 'Uses only the store in the authenticated token. Includes rules for soft-deleted products and uses Unknown Product when a product is missing, matching FranchiseStore.',
                tags: ['Quantitative'],
                responses: {
                    200: {
                        description: 'List of quantitative rules; empty array when none exist',
                        content: { 'application/json': { schema: { type: 'array', items: {
                            type: 'object', properties: {
                                storeId: { type: 'string', format: 'uuid' },
                                productId: { type: 'string', format: 'uuid' },
                                productName: { type: 'string' },
                                quantity: { type: 'integer' }
                            }
                        } } } }
                    },
                    401: { description: 'Authentication or valid token store required' },
                    500: { description: 'An unexpected error occurred.' }
                }
            }
        }
    }
};

export function setupSwagger(app: Express) {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
