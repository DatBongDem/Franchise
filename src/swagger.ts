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
        '/api/users/me': {
            get: {
                summary: 'Get Current Authenticated User Profile',
                tags: ['Users'],
                responses: { 200: { description: 'Profile details' } }
            }
        },
        '/api/users': {
            get: {
                summary: 'Get All Users (ADMIN, MANAGER)',
                tags: ['Users'],
                responses: { 200: { description: 'List of users' } }
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
            get: {
                summary: 'Get All Ingredients',
                tags: ['Ingredients'],
                responses: { 200: { description: 'List of ingredients' } }
            }
        },
        '/api/recipe': {
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
