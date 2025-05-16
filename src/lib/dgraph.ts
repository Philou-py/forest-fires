import { DgraphClientStub, DgraphClient } from 'dgraph-js';
// Load DGRAPH_URL dynamically so that the value passed in docker-compose.yml
// is taken into account when running the container
import { env } from '$env/dynamic/private';

const clientStub = new DgraphClientStub(env.DGRAPH_URL);
export const db = new DgraphClient(clientStub);
