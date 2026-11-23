import pytest
from fastapi.testclient import TestClient


def test_simple():
    assert True


@pytest.mark.parametrize("n", [1, 2])
def test_param(n):
    assert n


@pytest.mark.skip(reason="todo")
def test_skipped():
    pass


def helper_not_a_test():
    pass


class TestOrders:
    def test_create(self):
        pass

    @pytest.mark.xfail
    def test_cancel(self):
        pass

    def helper(self):
        pass


class NotTests:
    def test_ignored(self):
        pass
