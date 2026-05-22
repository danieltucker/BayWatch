from fastapi import APIRouter

from api.schemas import PoolRead, PoolTopologyRead, VdevRead, VdevDiskRead
from services import zpool as zpool_svc

router = APIRouter()


@router.get("", response_model=list[PoolRead])
def list_pools():
    pools = zpool_svc.get_pool_stats()
    return [
        PoolRead(
            name=p.name,
            size_bytes=p.size_bytes,
            alloc_bytes=p.alloc_bytes,
            free_bytes=p.free_bytes,
            capacity_pct=p.capacity_pct,
        )
        for p in pools
    ]


@router.get("/topology", response_model=list[PoolTopologyRead])
def get_topology():
    topology = zpool_svc.get_pool_topology()
    return [
        PoolTopologyRead(
            name=pool.name,
            state=pool.state,
            vdevs=[
                VdevRead(
                    name=v.name,
                    type=v.type,
                    state=v.state,
                    disks=[VdevDiskRead(path=d.path, state=d.state) for d in v.disks],
                )
                for v in pool.vdevs
            ],
        )
        for pool in topology
    ]
